// components/BlockModal.tsx
// Simplified from Besties components/block/BlockModal.tsx
import { FontAwesome } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from "react-native";

interface BlockModalProps {
  visible: boolean;
  onClose: () => void;
  onBlock: () => void;
  userName: string;
  loading?: boolean;
}

export function BlockModal({ visible, onClose, onBlock, userName, loading = false }: BlockModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modal}>
              <View style={styles.iconCircle}>
                <FontAwesome name="ban" size={28} color="#EF4444" />
              </View>
              <Text style={styles.title}>Block {userName}?</Text>
              <Text style={styles.description}>
                They won't be able to see your profile or message you. They won't be notified.
              </Text>
              <View style={styles.buttons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.blockBtn, loading && { opacity: 0.7 }]} onPress={onBlock} disabled={loading}>
                  {loading ? <ActivityIndicator size="small" color="#fff" /> : (
                    <><FontAwesome name="ban" size={16} color="#fff" /><Text style={styles.blockText}>Block</Text></>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 20 },
  modal: { backgroundColor: "#1E293B", borderRadius: 20, padding: 24, width: "100%", maxWidth: 340, alignItems: "center" },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(239,68,68,0.15)", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 20, fontWeight: "700", color: "#fff", marginBottom: 12 },
  description: { fontSize: 15, color: "rgba(255,255,255,0.5)", textAlign: "center", lineHeight: 22, marginBottom: 20 },
  buttons: { flexDirection: "row", gap: 12, width: "100%" },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center" },
  cancelText: { fontSize: 16, fontWeight: "600", color: "rgba(255,255,255,0.6)" },
  blockBtn: { flex: 1, flexDirection: "row", paddingVertical: 14, borderRadius: 12, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", gap: 8 },
  blockText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
