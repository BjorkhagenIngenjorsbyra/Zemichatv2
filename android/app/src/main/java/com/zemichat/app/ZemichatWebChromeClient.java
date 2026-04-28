package com.zemichat.app;

import android.webkit.PermissionRequest;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;

/**
 * The default Capacitor WebChromeClient does not always propagate getUserMedia
 * permission requests to the WebView even when OS-level RECORD_AUDIO / CAMERA
 * permissions are held — observed on Samsung WebView 130+ on Android 14.
 * Result: Agora SDK's createMicrophoneAudioTrack / createCameraVideoTrack
 * throws NotAllowedError, killing every voice and video call.
 *
 * The WebView only loads our own bundled app code at https://localhost (or
 * capacitor://localhost on iOS), so granting WebRTC capture unconditionally
 * is safe — the OS still enforces the runtime permission at the media
 * subsystem layer.
 */
public class ZemichatWebChromeClient extends BridgeWebChromeClient {

    public ZemichatWebChromeClient(Bridge bridge) {
        super(bridge);
    }

    @Override
    public void onPermissionRequest(final PermissionRequest request) {
        request.grant(request.getResources());
    }
}
