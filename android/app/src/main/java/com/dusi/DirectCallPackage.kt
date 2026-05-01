package com.dusi

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class DirectCallPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(DirectCallModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<@Suppress("DEPRECATION") ViewManager<*, *>> =
        emptyList()
}
