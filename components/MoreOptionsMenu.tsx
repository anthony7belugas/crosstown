// components/MoreOptionsMenu.tsx
// Three-dot bottom sheet with Block + Report — adapted from Besties
import { FontAwesome } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface MoreOptionsMenuProps {
  visible: boolean;
  onClose: () => void;
  onBlock: () => void;
  onReport: () => void;
}

export function MoreOptionsMenu({ visible, onClose, onBlock, onReport }: MoreOptionsMenuProps) {
  const handle = (action: () => void) => { onClose(); setTimeout(action, 100); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.menu}>
          <TouchableOpacity style={styles.item} onPress={() => handle(onBlock)} activeOpacity={0.7}>
            <View style={[styles.icon, { backgroundColor: "rgba(239,68,68,0.15)" }]}>
              <FontAwesome name="ban" size={18} color="#EF4444" />
            </View>
            <Text style={styles.itemText}>Block</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.item} onPress={() => handle(onReport)} activeOpacity={0.7}>
            <View style={[styles.icon, { backgroundColor: "rgba(245,158,11,0.15)" }]}>
              <FontAwesome name="flag" size={18} color="#F59E0B" />
            </View>
            <Text style={styles.itemText}>Report</Text>
          </TouchableOpacity>
          <View style={styles.thickDivider} />
          <TouchableOpacity style={styles.cancelItem} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  menu: { backgroundColor: "#1E293B", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, paddingBottom: 34 },
  item: { flexDirection: "row", alignItems: "center", paddingVertical: 16, paddingHorizontal: 20 },
  icon: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center", marginRight: 14 },
  itemText: { fontSize: 17, fontWeight: "500", color: "#fff" },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginLeft: 70 },
  thickDivider: { height: 8, backgroundColor: "rgba(255,255,255,0.04)", marginTop: 8 },
  cancelItem: { paddingVertical: 16, alignItems: "center" },
  cancelText: { fontSize: 17, fontWeight: "500", color: "rgba(255,255,255,0.5)" },
});
