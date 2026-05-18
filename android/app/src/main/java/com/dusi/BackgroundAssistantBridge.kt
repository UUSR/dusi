package com.dusi

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

object BackgroundAssistantBridge {
    private var reactContext: ReactApplicationContext? = null

    fun attachReactContext(context: ReactApplicationContext) {
        reactContext = context
    }

    fun emitPhrase(text: String) {
        val context = reactContext ?: return
        if (!context.hasActiveCatalystInstance()) {
            return
        }

        context
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("BackgroundAssistantPhrase", text)
    }

    fun emitState(enabled: Boolean, running: Boolean) {
        val context = reactContext ?: return
        if (!context.hasActiveCatalystInstance()) {
            return
        }

        val payload = Arguments.createMap().apply {
            putBoolean("enabled", enabled)
            putBoolean("running", running)
        }

        context
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("BackgroundAssistantState", payload)
    }
}
