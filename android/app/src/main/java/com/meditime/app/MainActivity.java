package com.meditime.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MediTimeNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
