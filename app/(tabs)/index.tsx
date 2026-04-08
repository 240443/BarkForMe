import { Audio } from 'expo-av';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function scheduleBarkReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🐶 BARK FOR ME',
      body: "You haven't barked in a while... open the app. NOW.",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 60 * 60 * 2,
      repeats: true,
    },
  });
}

const BARK_THRESHOLD = -25; // dB — louder than this = bark detected
const COOLDOWN_MS = 3000;

const GOOD_BOY_PHRASES = [
  "Good boy!",
  "Yes! That's my good boy!",
  "Excellent barking! Good boy!",
  "Woof approved! You're a good boy!",
  "Amazing! Such a good boy!",
];

export default function HomeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [audioPermission, setAudioPermission] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);
  const [barkDetected, setBarkDetected] = useState(false);
  const [goodBoyText, setGoodBoyText] = useState('');

  const recordingRef = useRef<Audio.Recording | null>(null);
  const cooldownRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBark = () => {
    if (cooldownRef.current) return;
    cooldownRef.current = true;

    const phrase = GOOD_BOY_PHRASES[Math.floor(Math.random() * GOOD_BOY_PHRASES.length)];
    setGoodBoyText(phrase);
    setBarkDetected(true);

    Speech.speak(phrase, {
      pitch: 1.3,
      rate: 0.85,
    });

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setBarkDetected(false);
      cooldownRef.current = false;
    }, COOLDOWN_MS);
  };

  const startListening = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        { ...Audio.RecordingOptionsPresets.LOW_QUALITY, isMeteringEnabled: true },
        (status) => {
          if (status.isRecording && status.metering !== undefined && status.metering > BARK_THRESHOLD) {
            handleBark();
          }
        },
        100
      );
      recordingRef.current = recording;
    } catch (e) {
      console.error('Could not start listening:', e);
    }
  };

  useEffect(() => {
    Speech.speak('Hello! Now bark for me!', {
      pitch: 1.2,
      rate: 0.85,
    });

    (async () => {
      // Notification permission
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        setNotifGranted(true);
        await scheduleBarkReminders();
      }

      // Microphone permission
      const { granted } = await Audio.requestPermissionsAsync();
      if (granted) {
        setAudioPermission(true);
      }
    })();

    return () => {
      recordingRef.current?.stopAndUnloadAsync();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (audioPermission) {
      startListening();
    }
  }, [audioPermission]);

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>🐶 This app needs camera access to make you bark</Text>
        <Button onPress={requestPermission} title="Allow Camera" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="front">
        <View style={styles.overlay}>
          {barkDetected ? (
            <>
              <Text style={styles.pawText}>🐾</Text>
              <Text style={styles.goodBoyText}>{goodBoyText}</Text>
              <Text style={styles.pawText}>🐾</Text>
            </>
          ) : (
            <>
              <Text style={styles.barkTitle}>🐶 BARK FOR ME 🐶</Text>
              <Text style={styles.barkCommand}>NOW BARK.</Text>
              <Text style={styles.barkSub}>I'm not joking. Bark.</Text>
            </>
          )}
          {notifGranted && (
            <Text style={styles.notifBadge}>🔔 Reminders are on</Text>
          )}
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    gap: 16,
  },
  barkTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  barkCommand: {
    fontSize: 80,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
  },
  barkSub: {
    fontSize: 22,
    color: 'white',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  goodBoyText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
  },
  pawText: {
    fontSize: 60,
  },
  notifBadge: {
    position: 'absolute',
    bottom: 40,
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    gap: 20,
  },
  permissionText: {
    fontSize: 18,
    textAlign: 'center',
  },
});