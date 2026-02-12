#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Capacitor plugin registration bridge for CallKitService.
// This file registers the Swift plugin with Capacitor's plugin system.

CAP_PLUGIN(CallKitService, "CallKitService",
    CAP_PLUGIN_METHOD(registerVoipPush, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getPendingCallAction, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(dismissCallNotification, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(reportCallConnected, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(reportCallEnded, CAPPluginReturnPromise);
)
