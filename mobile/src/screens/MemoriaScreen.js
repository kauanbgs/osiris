    import React, { useState } from 'react';
    import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    } from 'react-native';
    import { SafeAreaView } from 'react-native-safe-area-context';
    import BottomNav from '../components/Navbar';

    const colors = {
    background: '#0d0d0d',
    card: '#161616',
    cardBorder: '#242424',
    textPrimary: '#e8e8e8',
    textSecondary: '#8a8a8a',
    purple: '#7c5cff',
    inputBg: '#0d0d0d',
    inputBorder: '#2a2a2a',
    };

    export default function MemoriaScreen({ navigation }) {
    const [newItem, setNewItem] = useState('');
    const [memories, setMemories] = useState([]);

    function handleSave() {
        const text = newItem.trim();
        if (!text) return;

        setMemories((prev) => [...prev, { id: `${Date.now()}`, text }]);
        setNewItem('');
    }

    function handleNavPress(key) {
        if (key === 'home') {
        navigation.navigate('HomeScreen');
        return;
        }

        console.log('nav:', key);
    }

    const hasMemories = memories.length > 0;

    return (
        <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
            <Text style={styles.title}>Memória</Text>

            <View style={styles.card}>
            <Text style={styles.cardLabel}>Adicionar novo item à memória</Text>

            <View style={styles.addRow}>
                <TextInput
                style={styles.input}
                placeholder="Digite aqui"
                placeholderTextColor="#666"
                value={newItem}
                onChangeText={setNewItem}
                />

                <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Salvar</Text>
                </TouchableOpacity>
            </View>
            </View>

            <View style={styles.listCard}>
            {hasMemories ? (
                <FlatList
                data={memories}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <View style={styles.memoryItem}>
                    <Text style={styles.memoryItemText}>{item.text}</Text>
                    </View>
                )}
                contentContainerStyle={styles.listContent}
                />
            ) : (
                <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                    Nenhuma memória até o momento.
                </Text>
                </View>
            )}
            </View>
        </View>

        <BottomNav onPressItem={handleNavPress} />
        </SafeAreaView>
    );
    }

    const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.background,
    },

    content: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 16,
    },

    title: {
        fontSize: 22,
        fontWeight: '700',
        color: colors.textPrimary,
        textAlign: 'center',
        marginBottom: 20,
    },

    card: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
    },

    cardLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 10,
    },

    addRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    input: {
        flex: 1,
        backgroundColor: colors.inputBg,
        borderWidth: 1,
        borderColor: colors.inputBorder,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: colors.textPrimary,
        fontSize: 14,
        marginRight: 10,
    },

    saveButton: {
        backgroundColor: colors.purple,
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },

    saveButtonText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
    },

    listCard: {
        flex: 1,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        borderRadius: 16,
        marginBottom: 16,
    },

    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },

    emptyStateText: {
        fontSize: 13,
        color: colors.textSecondary,
        textAlign: 'center',
    },

    listContent: {
        padding: 16,
    },

    memoryItem: {
        backgroundColor: '#1f1f1f',
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
    },

    memoryItemText: {
        fontSize: 14,
        color: colors.textPrimary,
    },
    });