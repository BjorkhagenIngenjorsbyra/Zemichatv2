import Foundation
import Capacitor
import PushKit
import CallKit

// ============================================================
// CallKitService — Capacitor Plugin for iOS VoIP/CallKit
// ============================================================
// Handles:
// 1. PushKit VoIP push registration & token delivery
// 2. Incoming call reporting to CallKit (native call UI)
// 3. Call answer/decline actions bridged back to JS
// 4. Call lifecycle management (connected, ended)
// ============================================================

@objc(CallKitService)
public class CallKitService: CAPPlugin, CXProviderDelegate, PKPushRegistryDelegate {

    // MARK: - Static state (accessible before plugin is fully loaded)
    private static var pendingCallAction: [String: Any]? = nil

    private var provider: CXProvider?
    private var voipRegistry: PKPushRegistry?
    private var callController = CXCallController()

    // Map callLogId -> UUID for CallKit
    private var activeCallUUIDs: [String: UUID] = [:]

    // Cache incoming call data from VoIP push (needed when user answers via CallKit)
    private var incomingCallData: [String: [String: String]] = [:]

    // MARK: - Plugin Lifecycle

    override public func load() {
        let config = CXProviderConfiguration()
        config.maximumCallGroups = 1
        config.maximumCallsPerCallGroup = 1
        config.supportsVideo = true
        config.supportedHandleTypes = [.generic]
        // Uncomment and set when you have an app icon for CallKit:
        // config.iconTemplateImageData = UIImage(named: "CallKitIcon")?.pngData()

        provider = CXProvider(configuration: config)
        provider?.setDelegate(self, queue: nil)
    }

    // MARK: - Plugin Methods (exposed to JS)

    /// Register for VoIP pushes via PushKit.
    /// The VoIP token is delivered asynchronously via the 'voipTokenReceived' event.
    @objc func registerVoipPush(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else {
                call.reject("Plugin deallocated")
                return
            }

            self.voipRegistry = PKPushRegistry(queue: .main)
            self.voipRegistry?.delegate = self
            self.voipRegistry?.desiredPushTypes = [.voIP]

            call.resolve()
        }
    }

    /// Get pending call action (if user answered via native CallKit UI).
    /// Returns { data: NativeCallAction | null }.
    @objc func getPendingCallAction(_ call: CAPPluginCall) {
        if let action = CallKitService.pendingCallAction {
            CallKitService.pendingCallAction = nil
            call.resolve(["data": action])
        } else {
            call.resolve(["data": NSNull()])
        }
    }

    /// Dismiss the CallKit incoming call UI.
    @objc func dismissCallNotification(_ call: CAPPluginCall) {
        // End all active calls in CallKit
        for (_, uuid) in activeCallUUIDs {
            let endAction = CXEndCallAction(call: uuid)
            let transaction = CXTransaction(action: endAction)
            callController.request(transaction) { error in
                if let error = error {
                    print("CallKitService: Failed to end call: \(error.localizedDescription)")
                }
            }
        }
        activeCallUUIDs.removeAll()
        call.resolve()
    }

    /// Report to CallKit that the call is now connected (stops ringing).
    @objc func reportCallConnected(_ call: CAPPluginCall) {
        guard let callLogId = call.getString("callLogId"),
              let uuid = activeCallUUIDs[callLogId] else {
            call.resolve()
            return
        }

        provider?.reportCall(with: uuid, connectedAt: Date())
        call.resolve()
    }

    /// Report to CallKit that the call has ended.
    @objc func reportCallEnded(_ call: CAPPluginCall) {
        guard let callLogId = call.getString("callLogId"),
              let uuid = activeCallUUIDs[callLogId] else {
            call.resolve()
            return
        }

        let reasonStr = call.getString("reason") ?? "remoteEnded"
        let reason: CXCallEndedReason

        switch reasonStr {
        case "answeredElsewhere":
            reason = .answeredElsewhere
        case "declinedElsewhere":
            reason = .declinedElsewhere
        case "failed":
            reason = .failed
        default:
            reason = .remoteEnded
        }

        provider?.reportCall(with: uuid, endedAt: Date(), reason: reason)
        activeCallUUIDs.removeValue(forKey: callLogId)
        incomingCallData.removeValue(forKey: callLogId)
        call.resolve()
    }

    // MARK: - PKPushRegistryDelegate

    /// Called when PushKit provides a VoIP push token.
    public func pushRegistry(
        _ registry: PKPushRegistry,
        didUpdate pushCredentials: PKPushCredentials,
        for type: PKPushType
    ) {
        guard type == .voIP else { return }

        let token = pushCredentials.token
            .map { String(format: "%02x", $0) }
            .joined()

        // Notify JS of the VoIP token
        notifyListeners("voipTokenReceived", data: ["token": token])
    }

    /// Called when a VoIP push is received.
    /// IMPORTANT: Must immediately report to CallKit or iOS will kill the app.
    public func pushRegistry(
        _ registry: PKPushRegistry,
        didReceiveIncomingPushWith payload: PKPushPayload,
        for type: PKPushType,
        completion: @escaping () -> Void
    ) {
        guard type == .voIP else {
            completion()
            return
        }

        let data = payload.dictionaryPayload
        let pushType = data["type"] as? String ?? ""

        if pushType == "incoming_call" {
            let callLogId = data["callLogId"] as? String ?? ""
            let chatId = data["chatId"] as? String ?? ""
            let callType = data["callType"] as? String ?? "voice"
            let callerId = data["callerId"] as? String ?? ""
            let callerName = data["callerName"] as? String ?? "Unknown"
            let callerAvatar = data["callerAvatar"] as? String ?? ""

            let uuid = UUID()
            activeCallUUIDs[callLogId] = uuid

            // Cache call data so we can pass it to JS when user answers
            incomingCallData[callLogId] = [
                "callLogId": callLogId,
                "chatId": chatId,
                "callType": callType,
                "callerId": callerId,
                "callerName": callerName,
                "callerAvatar": callerAvatar
            ]

            // Report incoming call to CallKit
            let update = CXCallUpdate()
            update.localizedCallerName = callerName
            update.remoteHandle = CXHandle(type: .generic, value: callerId)
            update.hasVideo = (callType == "video")
            update.supportsDTMF = false
            update.supportsHolding = false
            update.supportsGrouping = false
            update.supportsUngrouping = false

            provider?.reportNewIncomingCall(with: uuid, update: update) { error in
                if let error = error {
                    print("CallKitService: Failed to report incoming call: \(error.localizedDescription)")
                    self.activeCallUUIDs.removeValue(forKey: callLogId)
                }
                completion()
            }
        } else if pushType == "call_cancelled" {
            // Caller cancelled — end the CallKit call
            let callLogId = data["callLogId"] as? String ?? ""
            if let uuid = activeCallUUIDs[callLogId] {
                provider?.reportCall(with: uuid, endedAt: Date(), reason: .remoteEnded)
                activeCallUUIDs.removeValue(forKey: callLogId)
            }
            completion()
        } else {
            // Unknown push type — still must report a call to avoid being killed
            // Report and immediately end it
            let uuid = UUID()
            let update = CXCallUpdate()
            update.localizedCallerName = "Zemichat"
            update.remoteHandle = CXHandle(type: .generic, value: "unknown")

            provider?.reportNewIncomingCall(with: uuid, update: update) { _ in
                self.provider?.reportCall(with: uuid, endedAt: Date(), reason: .failed)
                completion()
            }
        }
    }

    public func pushRegistry(
        _ registry: PKPushRegistry,
        didInvalidatePushTokenFor type: PKPushType
    ) {
        // Token invalidated — will get a new one on next registration
        print("CallKitService: VoIP push token invalidated")
    }

    // MARK: - CXProviderDelegate

    /// User answered the call from CallKit UI.
    public func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        // Find the callLogId for this UUID
        guard let callLogId = activeCallUUIDs.first(where: { $0.value == action.callUUID })?.key else {
            action.fulfill()
            return
        }

        // Use cached call data from the VoIP push
        let cachedData = incomingCallData[callLogId]

        CallKitService.pendingCallAction = [
            "action": "answer",
            "callLogId": callLogId,
            "chatId": cachedData?["chatId"] ?? "",
            "callType": cachedData?["callType"] ?? "voice",
            "callerId": cachedData?["callerId"] ?? "",
            "callerName": cachedData?["callerName"] ?? "Unknown",
            "callerAvatar": cachedData?["callerAvatar"] ?? ""
        ]

        // The app will be brought to foreground — JS polls getPendingCallAction()
        action.fulfill()
    }

    /// User declined the call from CallKit UI.
    public func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        // Find and remove the call
        if let callLogId = activeCallUUIDs.first(where: { $0.value == action.callUUID })?.key {
            activeCallUUIDs.removeValue(forKey: callLogId)
            incomingCallData.removeValue(forKey: callLogId)
        }
        action.fulfill()
    }

    public func providerDidReset(_ provider: CXProvider) {
        // Provider was reset — clean up all calls
        activeCallUUIDs.removeAll()
        incomingCallData.removeAll()
    }

    public func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
        // Audio session activated by CallKit — Agora will handle audio
    }

    public func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
        // Audio session deactivated
    }
}
