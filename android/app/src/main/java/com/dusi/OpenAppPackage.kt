package com.dusi

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class OpenAppPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(OpenAppModule(reactContext))

    @Suppress("OVERRIDE_DEPRECATION")
    override fun createViewManagers(reactContext: ReactApplicationContext): List<@Suppress("DEPRECATION") ViewManager<*, *>> =
        emptyList()
}
