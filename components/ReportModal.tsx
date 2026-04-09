// components/ReportModal.tsx
// Simplified from Besties components/block/ReportModal.tsx
import { FontAwesome } from "@expo/vector-icons";
import React, { useState } from "react";
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { ReportReason } from "../utils/blockUtils";

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: ReportReason, description?: string) => void;
  userName: string;
  loading?: boolean;
}

const REASONS: { id: ReportReason; label: string; icon: string }[] = [
  { id: "spam", label: "Spam", icon: "exclamation-triangle" },
  { id: "harassment", label: "Harassment", icon: "user-times" },
  { id: "inappropriate_content", label: "Inappropriate content", icon: "ban" },
  { id: "fake_profile", label: "Fake profile", icon: "user-secret" },
  { id: "other", label: "Other", icon: "ellipsis-h" },
];

export function ReportModal({ visible, onClose, onSubmit, userName, loading = false }: ReportModalProps) {
  const [selected, setSelected] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    if (!selected) return;
    onSubmit(selected, description.trim() || undefined);
    setSelected(null);
    setDescription("");
  };

  const handleClose = () => { setSelected(null); setDescription(""); onClose(); };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose}><FontAwesome name="times" size={22} color="rgba(255,255,255,0.6)" /></TouchableOpacity>
          <Text style={styles.headerTitle}>Report User</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.infoBar}>
            <FontAwesome name="flag" size={14} color="#F59E0B" />
            <Text style={styles.infoText}>Reporting {userName}</Text>
          </View>
          <Text style={styles.sectionTitle}>Why are you reporting?</Text>
          {REASONS.map((r) => (
            <TouchableOpacity key={r.id} style={[styles.option, selected === r.id && styles.optionSelected]} onPress={() => setSelected(r.id)}>
              <FontAwesome name={r.icon as any} size={16} color={selected === r.id ? "#FFD100" : "rgba(255,255,255,0.4)"} />
              <Text style={[styles.optionText, selected === r.id && styles.optionTextSelected]}>{r.label}</Text>
              <View style={[styles.radio, selected === r.id && styles.radioSelected]}>
                {selected === r.id && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          ))}
          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Details (optional)</Text>
          <TextInput style={styles.textArea} placeholder="Add details..." placeholderTextColor="rgba(255,255,255,0.2)" multiline maxLength={500} value={description} onChangeText={setDescription} textAlignVertical="top" />
        </ScrollView>
        <View style={styles.footer}>
          <TouchableOpacity style={[styles.submitBtn, !selected && { opacity: 0.4 }]} onPress={handleSubmit} disabled={!selected || loading}>
            {loading ? <ActivityIndicator color="#1E293B" /> : <Text style={styles.submitText}>Submit Report</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 16, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  content: { padding: 20 },
  infoBar: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(245,158,11,0.1)", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, marginBottom: 24, gap: 10 },
  infoText: { fontSize: 14, fontWeight: "500", color: "#F59E0B" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#fff", marginBottom: 12 },
  option: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.06)", gap: 14 },
  optionSelected: { borderColor: "#FFD100", backgroundColor: "rgba(255,209,0,0.06)" },
  optionText: { flex: 1, fontSize: 16, fontWeight: "600", color: "rgba(255,255,255,0.5)" },
  optionTextSelected: { color: "#fff" },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  radioSelected: { borderColor: "#FFD100" },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#FFD100" },
  textArea: { fontSize: 15, color: "#fff", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 14, minHeight: 80, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  footer: { padding: 20, paddingBottom: 34, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" },
  submitBtn: { backgroundColor: "#FFD100", paddingVertical: 16, borderRadius: 12, alignItems: "center" },
  submitText: { fontSize: 17, fontWeight: "700", color: "#1E293B" },
});
