# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ---- AbiaConnect ----
# Keep crash reports readable on Google Play (the mapping file is uploaded with the bundle).
-keepattributes SourceFile,LineNumberTable,*Annotation*,Signature,InnerClasses,EnclosingMethod,Exceptions
-renamesourcefileattribute SourceFile

# Methods the web page calls through window.AbiaCallBridge / AbiaAuthBridge.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# The app's own code: small, and reached from the manifest, notifications and the web page.
-keep class com.abiaconnect.app.** { *; }

# Capacitor and its plugins are found by name at start-up.
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keep class org.apache.cordova.** { *; }
-keep class * extends org.apache.cordova.CordovaPlugin { *; }
-keep class com.capacitorjs.plugins.** { *; }

# Firebase messaging (push alerts and incoming calls).
-keep class com.google.firebase.messaging.** { *; }
-dontwarn com.google.firebase.**
