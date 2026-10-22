import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  TouchableWithoutFeedback,
  Platform,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";

export default function PlusActionMenu({
  visible,
  onClose,
  onSelectCamera,
  onSelectPhotos,
  onSelectFiles,
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.menuContainer}>
              {/* Item: Câmera */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  onSelectCamera();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="camera-outline" size={20} color="#ffffff" />
                </View>
                <Text style={styles.itemText}>Câmera</Text>
              </TouchableOpacity>

              {/* Item: Fotos */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  onSelectPhotos();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="images-outline" size={20} color="#ffffff" />
                </View>
                <Text style={styles.itemText}>Fotos</Text>
              </TouchableOpacity>

              {/* Item: Arquivos */}
              <TouchableOpacity
                style={[styles.menuItem, styles.lastMenuItem]}
                onPress={() => {
                  onClose();
                  onSelectFiles();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="attach-outline" size={20} color="#ffffff" />
                </View>
                <Text style={styles.itemText}>Arquivos</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "flex-end",
    paddingBottom: Platform.OS === "ios" ? 140 : 120,
    paddingLeft: 16,
  },
  menuContainer: {
    width: 220,
    backgroundColor: "#1e1e24",
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#2f2f3a",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    gap: 12,
  },
  lastMenuItem: {
    // último item sem margem extra
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#2c2c36",
    justifyContent: "center",
    alignItems: "center",
  },
  itemText: {
    fontSize: 15,
    color: "#f3f3f6",
    fontWeight: "500",
  },
});
