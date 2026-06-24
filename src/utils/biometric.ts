import { NativeBiometric, BiometryType } from 'capacitor-native-biometric';
import { Capacitor } from '@capacitor/core';

export async function checkBiometricAvailability() {
  if (!Capacitor.isNativePlatform()) return false;

  try {
    const result = await NativeBiometric.isAvailable();
    return result.isAvailable;
  } catch (error) {
    console.error('Biometric check failed:', error);
    return false;
  }
}

export async function performBiometricAuth(reason: string = 'Authenticate to sign in to AbiaConnect') {
  if (!Capacitor.isNativePlatform()) return false;

  try {
    const isAvailable = await checkBiometricAvailability();
    if (!isAvailable) return false;

    await NativeBiometric.verifyIdentity({
      reason,
      title: 'Biometric Login',
      subtitle: 'Use your fingerprint or face to sign in',
      description: 'Sign in to your AbiaConnect account securely',
    });

    return true;
  } catch (error) {
    console.error('Biometric authentication failed:', error);
    return false;
  }
}

export async function saveCredentials(email: string, password: string) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await NativeBiometric.setCredentials({
      username: email,
      password: password,
      server: 'abiaconnect.com',
    });
  } catch (error) {
    console.error('Failed to save credentials:', error);
  }
}

export async function getStoredCredentials() {
  if (!Capacitor.isNativePlatform()) return null;

  try {
    return await NativeBiometric.getCredentials({
      server: 'abiaconnect.com',
    });
  } catch (error) {
    console.error('Failed to retrieve credentials:', error);
    return null;
  }
}

export async function deleteStoredCredentials() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await NativeBiometric.deleteCredentials({
      server: 'abiaconnect.com',
    });
  } catch (error) {
    console.error('Failed to delete credentials:', error);
  }
}
