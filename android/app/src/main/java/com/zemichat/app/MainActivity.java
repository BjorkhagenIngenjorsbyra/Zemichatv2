package com.zemichat.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Register plugins before super.onCreate() — Bridge dispatches initial intent in load()
        registerPlugin(ShareTargetPlugin.class);
        registerPlugin(CallNotificationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
