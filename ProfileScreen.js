import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, TextInput, Modal, FlatList, Platform, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import MapView, { Marker } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';

// --- นำเข้า Firestore (ไม่ใช้ Firebase Auth เพราะระบบเช็ค login ผ่าน Firestore เอง) ---
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';

export default function ProfileScreen({ currentUserPhone, onGoHome, onGoSOS, onGoSearch, onGoProfile, onLogout, onUpdateContact }) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userDocId, setUserDocId] = useState(null); // เก็บ document id ของ user ใน Firestore

  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const [pickerData, setPickerData] = useState([]);
  const [currentPickerField, setCurrentPickerField] = useState('');
  const [dateValue, setDateValue] = useState(new Date());

  // ✅ เพิ่ม state สำหรับเก็บรายการจาก Firestore
  const [emergencyOptions, setEmergencyOptions] = useState([]);

  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    weight: '',
    height: '',
    birthDate: '01/01/2540',
    gender: 'ไม่ระบุ',
    bloodType: 'ไม่ทราบ',
    organDonor: 'ฉันไม่ใช่ผู้บริจาคอวัยวะ',
    aboutMe: 'ไม่มี',
    address: '',
    coordinate: { latitude: 14.8782, longitude: 102.0194 },
    emergencyContact: { name: 'สถานีตำรวจ', phone: '191' },
    profileImage: 'https://cdn-icons-png.flaticon.com/512/149/149071.png'
  });

  // --- 1. ดึงข้อมูลจาก Firestore โดยใช้เบอร์โทรศัพท์ที่ส่งมาจาก App.js ---
  useEffect(() => {
    const fetchUserData = async () => {
      // ถ้าไม่มีเบอร์โทรส่งมา ไม่ต้องทำอะไร (อาจจะยังไม่ได้ login)
      if (!currentUserPhone) {
        console.warn("ไม่ได้รับเบอร์โทรศัพท์ของผู้ใช้ - กรุณาเช็คว่าส่ง prop currentUserPhone มาจาก App.js แล้ว");
        setLoading(false);
        return;
      }

      try {
        // ค้นหา document ใน collection 'users' ที่มี phone_number ตรงกับเบอร์ที่ login
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('phone_number', '==', currentUserPhone));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const userDoc = snapshot.docs[0];
          setUserDocId(userDoc.id); // เก็บ doc id ไว้ใช้ตอนบันทึก/แก้ไข

          const data = userDoc.data();
          // รวมข้อมูลจาก firestore เข้ากับ profile state
          // หมายเหตุ: ใน firestore ใช้ key 'phone_number' แต่ใน state ใช้ 'phone'
          setProfile(prev => ({
            ...prev,
            ...data,
            phone: data.phone_number || currentUserPhone, // map phone_number → phone
          }));

          if (data.emergencyContact && onUpdateContact) {
            onUpdateContact(data.emergencyContact);
          }
        } else {
          console.warn("ไม่พบข้อมูลผู้ใช้ที่มีเบอร์:", currentUserPhone);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [currentUserPhone]);

  // ✅ ดึงรายการจาก Firestore collection emergency_services
  useEffect(() => {
    const fetchEmergencyServices = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'emergency_services'));
        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          name: docSnap.data().title,
          phone: docSnap.data().phone,
          desc: docSnap.data().category,
          image: require('./assets/telephone.png'),
        }));
        setEmergencyOptions(data);
      } catch (e) {
        console.error('fetch emergency_services error:', e);
      }
    };
    fetchEmergencyServices();
  }, []);

  const calculateAge = (bDate) => {
    try {
      const parts = bDate.split('/');
      const yearAD = parseInt(parts[2]) - 543;
      const birth = new Date(yearAD, parts[1] - 1, parts[0]);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return age > 0 ? age : 0;
    } catch (e) { return 0; }
  };

  // ✅ เมื่อกดปุ่มออกจากระบบ → เปิด Modal ยืนยัน (ไม่ออกทันที)
  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  // ✅ ยืนยันออกจากระบบจริง (ไม่ต้องเรียก signOut เพราะระบบนี้ไม่ได้ใช้ Firebase Auth)
  const confirmLogout = () => {
    setShowLogoutModal(false);
    if (onLogout) {
      onLogout(); // App.js จะเคลียร์ userPhone, userRole และพากลับไปหน้า Login
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled) {
      setProfile({ ...profile, profileImage: result.assets[0].uri });
    }
  };

  const openPicker = (field, options) => {
    setCurrentPickerField(field);
    setPickerData(options);
    setShowPickerModal(true);
  };

  const selectPickerValue = (value) => {
    setProfile({ ...profile, [currentPickerField]: value });
    setShowPickerModal(false);
  };

  const onDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (event.type === 'dismissed') return;

    if (selectedDate) {
      setDateValue(selectedDate);
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const year = selectedDate.getFullYear() + 543;
      setProfile(prev => ({ ...prev, birthDate: `${day}/${month}/${year}` }));
    }
  };

  const handleMapPress = async (e) => {
    const coord = e.nativeEvent.coordinate;
    setProfile(prev => ({ ...prev, coordinate: coord }));

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${coord.latitude}&lon=${coord.longitude}&format=json&accept-language=th`
      );
      const data = await res.json();
      const address = data.display_name || `${coord.latitude.toFixed(5)}, ${coord.longitude.toFixed(5)}`;
      setProfile(prev => ({ ...prev, coordinate: coord, address: address }));
    } catch (err) {
      setProfile(prev => ({ ...prev, coordinate: coord, address: `${coord.latitude.toFixed(5)}, ${coord.longitude.toFixed(5)}` }));
    }
  };

  // --- 2. บันทึกข้อมูลลง Firestore (ใช้ userDocId ที่เก็บไว้ตอนโหลด) ---
  const confirmSave = async () => {
    setShowConfirmModal(false);

    if (!userDocId) {
      Alert.alert("ผิดพลาด", "ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบอีกครั้ง");
      return;
    }

    try {
      const userDocRef = doc(db, 'users', userDocId);

      // แยก phone ออก เพราะใน Firestore ใช้ key 'phone_number' (ไม่อัปเดต field นี้)
      // และไม่อัปเดต password กับ role เพื่อความปลอดภัย
      const { phone, password, role, ...profileToSave } = profile;

      await updateDoc(userDocRef, profileToSave);

      setIsEditing(false);
      Alert.alert("สำเร็จ", "บันทึกข้อมูลเรียบร้อยแล้ว");
    } catch (error) {
      console.error("Error saving profile:", error);
      Alert.alert("ผิดพลาด", "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#FF8A4C" />
        <Text style={{ marginTop: 10, color: '#888' }}>กำลังโหลดข้อมูล...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {isEditing ? (
        <View style={{ flex: 1 }}>
          <ScrollView style={styles.container}>
            <View style={styles.editHeader}>
              <TouchableOpacity onPress={() => setIsEditing(false)}>
                <Ionicons name="arrow-back" size={24} color="#333" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowConfirmModal(true)}>
                <Text style={styles.saveText}>บันทึก</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.profileImageSection}>
              <Image source={{ uri: profile.profileImage }} style={styles.editProfilePic} />
              <TouchableOpacity onPress={pickImage}>
                <Text style={styles.changePicText}>เลือกรูปภาพใหม่</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>ข้อมูลทั่วไป</Text>
              <View style={styles.rowInputs}>
                <View style={[styles.inputBox, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.inputLabel}>ชื่อ</Text>
                  <TextInput style={styles.inputText} value={profile.firstName} onChangeText={(text) => setProfile({ ...profile, firstName: text })} />
                </View>
                <View style={[styles.inputBox, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>นามสกุล</Text>
                  <TextInput style={styles.inputText} value={profile.lastName} onChangeText={(text) => setProfile({ ...profile, lastName: text })} />
                </View>
              </View>

              <View style={styles.rowInputs}>
                <View style={[styles.inputBox, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.inputLabel}>น้ำหนัก</Text>
                  <TextInput style={styles.inputText} value={profile.weight} keyboardType="numeric" onChangeText={(text) => setProfile({ ...profile, weight: text })} />
                </View>
                <View style={[styles.inputBox, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>ส่วนสูง</Text>
                  <TextInput style={styles.inputText} value={profile.height} keyboardType="numeric" onChangeText={(text) => setProfile({ ...profile, height: text })} />
                </View>
              </View>

              <TouchableOpacity style={styles.inputBox} onPress={() => {
                try {
                  const parts = profile.birthDate.split('/');
                  const yearAD = parseInt(parts[2]) - 543;
                  setDateValue(new Date(yearAD, parseInt(parts[1]) - 1, parseInt(parts[0])));
                } catch (e) { setDateValue(new Date()); }
                setShowDatePicker(true);
              }}>
                <Text style={styles.inputLabel}>เลือกวันเกิด</Text>
                <View style={styles.datePickerRow}>
                  <Text style={styles.inputText}>{profile.birthDate}</Text>
                  <Ionicons name="calendar-outline" size={20} color="#555" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.inputBox} onPress={() => openPicker('gender', ['ชาย', 'หญิง', 'ไม่ระบุ'])}>
                <Text style={styles.inputLabel}>เพศ</Text>
                <View style={styles.datePickerRow}>
                  <Text style={styles.inputText}>{profile.gender}</Text>
                  <Ionicons name="caret-down" size={16} color="#888" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.inputBox} onPress={() => openPicker('bloodType', ['A', 'B', 'AB', 'O', 'ไม่ทราบ'])}>
                <Text style={styles.inputLabel}>กรุ๊ปเลือด</Text>
                <View style={styles.datePickerRow}>
                  <Text style={styles.inputText}>{profile.bloodType}</Text>
                  <Ionicons name="caret-down" size={16} color="#888" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.inputBox} onPress={() => openPicker('organDonor', ['ฉันเป็นผู้บริจาคอวัยวะ', 'ฉันไม่ใช่ผู้บริจาคอวัยวะ'])}>
                <Text style={styles.inputLabel}>สถานะการบริจาคอวัยวะ</Text>
                <View style={styles.datePickerRow}>
                  <Text style={styles.inputText}>{profile.organDonor}</Text>
                  <Ionicons name="caret-down" size={16} color="#888" />
                </View>
              </TouchableOpacity>

              <Text style={styles.sectionTitle}>ข้อมูลเกี่ยวกับฉัน</Text>
              <View style={[styles.inputBox, { height: 100 }]}>
                <Text style={styles.inputLabel}>โรคประจำตัว / ข้อมูลเพิ่มเติม</Text>
                <TextInput
                  style={[styles.inputText, { textAlignVertical: 'top', marginTop: 5 }]}
                  multiline={true}
                  value={profile.aboutMe}
                  onChangeText={(text) => setProfile({ ...profile, aboutMe: text })}
                />
              </View>

              <Text style={styles.sectionTitle}>ที่อยู่</Text>
              <TouchableOpacity style={styles.inputBox} onPress={() => setShowMapModal(true)}>
                <Text style={styles.inputLabel}>แตะเพื่อเปิดแผนที่และปักหมุด</Text>
                <View style={styles.datePickerRow}>
                  <Text style={[styles.inputText, { color: '#007AFF' }]}>จัดการพิกัดที่อยู่ปัจจุบัน</Text>
                  <Ionicons name="map" size={20} color="#007AFF" />
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      ) : (
        <ScrollView style={styles.container}>
          <View style={styles.headerContainerView}>
            <Image source={{ uri: profile.profileImage }} style={styles.profilePic} />
            <View style={styles.headerInfo}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.pageTitle}>โปรไฟล์</Text>
                <TouchableOpacity onPress={() => setIsEditing(true)}>
                  <Text style={styles.editText}>แก้ไขโปรไฟล์</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.infoText}>ชื่อ : {profile.firstName} {profile.lastName}</Text>
              <Text style={styles.infoText}>เบอร์โทร : {profile.phone}</Text>
            </View>
          </View>

          <LinearGradient colors={['#F08C28', '#F5C242']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.gradientCard}>
            <Text style={styles.cardHeaderTitle}>{profile.firstName}</Text>
            <Text style={styles.cardText}>อายุ {calculateAge(profile.birthDate)} ปี | กรุ๊ปเลือด {profile.bloodType}</Text>
            <Text style={styles.cardText}>น้ำหนัก {profile.weight} กก. | ส่วนสูง {profile.height} ซม.</Text>
            <Text style={styles.cardText}>เพศ: {profile.gender}</Text>
            <View style={styles.divider} />
            <Text style={styles.cardText}>โรคประจำตัว : {profile.aboutMe}</Text>
            <Text style={styles.cardText}>{profile.organDonor}</Text>
          </LinearGradient>

          <TouchableOpacity style={styles.actionCard} onPress={() => setShowMapModal(true)}>
            <Ionicons name="map-outline" size={24} color="#555" />
            <View style={{ marginLeft: 15, flex: 1 }}>
              <Text style={styles.actionTitle}>ที่อยู่</Text>
              <Text style={styles.actionSub}>{profile.address}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => setShowEmergencyModal(true)}>
            <Ionicons name="call-outline" size={24} color="#555" />
            <View style={{ marginLeft: 15, flex: 1 }}>
              <Text style={styles.actionTitle}>รายชื่อติดต่อฉุกเฉิน</Text>
              <Text style={styles.actionSub}>{profile.emergencyContact.name} ({profile.emergencyContact.phone})</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionCard, { borderColor: '#FF3B30', backgroundColor: '#FFF0F0' }]} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
            <View style={{ marginLeft: 15, flex: 1 }}>
              <Text style={[styles.actionTitle, { color: '#FF3B30' }]}>ออกจากระบบ</Text>
              <Text style={[styles.actionSub, { color: '#FF8A8A' }]}>กลับสู่หน้าเข้าสู่ระบบ</Text>
            </View>
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      <Modal visible={showMapModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlaySlide}>
          <View style={[styles.modalContent, { height: '80%' }]}>
            <Text style={styles.modalTitle}>เลือกที่อยู่ของคุณ (แตะเพื่อปักหมุด)</Text>
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                initialRegion={{
                  latitude: profile.coordinate.latitude,
                  longitude: profile.coordinate.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                onPress={handleMapPress}
              >
                {profile.coordinate && <Marker coordinate={profile.coordinate} />}
              </MapView>
            </View>
            <TouchableOpacity style={styles.btnOrange} onPress={() => setShowMapModal(false)}>
              <Text style={styles.btnOrangeText}>ยืนยันที่อยู่</Text>
            </TouchableOpacity>
            {profile.address ? (
              <Text style={{ marginTop: 10, fontSize: 12, color: '#555', textAlign: 'center', paddingHorizontal: 10 }}>
                📍 {profile.address}
              </Text>
            ) : null}
          </View>
        </View>
      </Modal>

      {Platform.OS === 'ios' ? (
        <Modal visible={showDatePicker} animationType="fade" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={[styles.pickerContent, { padding: 20, alignItems: 'center' }]}>
              <DateTimePicker
                value={dateValue}
                mode="date"
                display="inline"
                onChange={onDateChange}
                style={{ width: 320, height: 320 }}
              />
              <TouchableOpacity style={[styles.btnOrange, { marginTop: 15 }]} onPress={() => setShowDatePicker(false)}>
                <Text style={styles.btnOrangeText}>ตกลง</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : (
        showDatePicker && (
          <DateTimePicker
            value={dateValue}
            mode="date"
            display="default"
            onChange={onDateChange}
          />
        )
      )}

      <Modal visible={showPickerModal} animationType="fade" transparent={true}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowPickerModal(false)}>
          <View style={styles.pickerContent}>
            <FlatList
              data={pickerData}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.pickerItem} onPress={() => selectPickerValue(item)}>
                  <Text style={styles.pickerItemText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showConfirmModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlaySlide}>
          <View style={styles.confirmModalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.confirmTitle}>ยืนยันการแก้ไขข้อมูลหรือไม่</Text>
            <TouchableOpacity style={styles.btnOrange} onPress={confirmSave}>
              <Text style={styles.btnOrangeText}>ยืนยันการแก้ไข</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnGray} onPress={() => setShowConfirmModal(false)}>
              <Text style={styles.btnGrayText}>ยกเลิก</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ✅ Modal เลือกเบอร์ติดต่อฉุกเฉิน ดึงจาก Firestore */}
      <Modal visible={showEmergencyModal} animationType="slide" transparent={false}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={styles.fullScreenHeader}>
            <TouchableOpacity onPress={() => setShowEmergencyModal(false)}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.fullScreenTitle}>เลือกเบอร์ติดต่อฉุกเฉิน</Text>
            <View style={{ width: 24 }} />
          </View>
          <FlatList
            data={emergencyOptions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.emergencyItemCard}
                onPress={() => {
                  // ✅ สร้าง contact object ที่มีแค่ name กับ phone ส่งให้ SOS
                  const selectedContact = { name: item.name, phone: item.phone };
                  setProfile({ ...profile, emergencyContact: selectedContact });
                  if (userDocId) {
                    updateDoc(doc(db, 'users', userDocId), { emergencyContact: selectedContact })
                      .catch(err => console.error("Error updating emergency contact:", err));
                  }
                  if (onUpdateContact) {
                    onUpdateContact(selectedContact);
                  }
                  setShowEmergencyModal(false);
                }}
              >
                <Image source={item.image} style={styles.customEmergencyIcon} />
                <View style={styles.emergencyTextContainer}>
                  <Text style={styles.emergencyName}>{item.name}</Text>
                  <Text style={styles.emergencyDesc}>{item.desc}</Text>
                  
                </View>
                <Text style={styles.selectButtonText}>เลือก</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', marginTop: 50 }}>
                <ActivityIndicator size="large" color="#FF8A4C" />
                <Text style={{ color: '#888', marginTop: 10 }}>กำลังโหลดรายการ...</Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>

      {/* ✅ Modal ยืนยันออกจากระบบ (แบบสวยๆ) */}
      <Modal visible={showLogoutModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlaySlide}>
          <View style={styles.logoutModalContent}>
            <View style={styles.modalHandle} />

            {/* วงกลมไอคอนสีแดง */}
            <View style={styles.logoutIconCircle}>
              <Ionicons name="log-out-outline" size={44} color="#FF3B30" />
            </View>

            <Text style={styles.logoutTitle}>ออกจากระบบ?</Text>
            <Text style={styles.logoutSubtitle}>
              คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ{'\n'}
              คุณจะต้องเข้าสู่ระบบอีกครั้งเพื่อใช้งาน
            </Text>

            <TouchableOpacity style={styles.btnRed} onPress={confirmLogout}>
              <Ionicons name="log-out-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.btnRedText}>ยืนยันออกจากระบบ</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnGray} onPress={() => setShowLogoutModal(false)}>
              <Text style={styles.btnGrayText}>ยกเลิก</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerButton} onPress={onGoHome}>
          <Image source={require('./assets/home (2).png')} style={[styles.footerIcon, { tintColor: '#929292' }]} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerButton} onPress={onGoSOS}>
          <Image source={require('./assets/emergency (1).png')} style={[styles.footerIcon, { tintColor: '#929292' }]} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerButton} onPress={onGoSearch}>
          <Image source={require('./assets/map (1).png')} style={[styles.footerIcon, { tintColor: '#929292' }]} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerButton} onPress={onGoProfile}>
          <Image source={require('./assets/user.png')} style={[styles.footerIcon, { tintColor: '#F87C47' }]} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 50 },
  headerContainerView: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  profilePic: { width: 70, height: 70, borderRadius: 35, marginRight: 15 },
  headerInfo: { flex: 1 },
  pageTitle: { fontSize: 22, fontWeight: 'bold' },
  editText: { color: '#007AFF', fontSize: 14, fontWeight: 'bold' },
  infoText: { fontSize: 14, color: '#666', marginTop: 3 },
  gradientCard: { borderRadius: 15, padding: 20, marginBottom: 20 },
  cardHeaderTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  cardText: { color: '#fff', fontSize: 15, marginBottom: 6 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.4)', marginVertical: 12 },
  actionCard: { flexDirection: 'row', alignItems: 'center', padding: 18, backgroundColor: '#f9f9f9', borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#eee' },
  actionTitle: { fontSize: 16, color: '#333', fontWeight: 'bold' },
  actionSub: { fontSize: 13, color: '#888', marginTop: 2 },
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  saveText: { color: '#007AFF', fontSize: 16, fontWeight: 'bold' },
  profileImageSection: { alignItems: 'center', marginBottom: 20 },
  editProfilePic: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#eee', marginBottom: 10 },
  changePicText: { color: '#007AFF', fontSize: 14 },
  formSection: { paddingBottom: 50 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 15, marginTop: 10 },
  rowInputs: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  inputBox: { backgroundColor: '#f5f5f5', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: '#e0e0e0', marginBottom: 15 },
  inputLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  inputText: { fontSize: 16, color: '#333', padding: 0 },
  datePickerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  pickerContent: { backgroundColor: '#fff', width: '80%', borderRadius: 12, overflow: 'hidden' },
  pickerItem: { paddingVertical: 15, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee' },
  pickerItemText: { fontSize: 16, color: '#333' },
  modalOverlaySlide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  confirmModalContent: { backgroundColor: '#fff', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 30, alignItems: 'center', paddingBottom: 50 },
  modalHandle: { width: 60, height: 6, backgroundColor: '#ccc', borderRadius: 3, marginBottom: 20 },
  confirmTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 25, textAlign: 'center' },
  btnOrange: { backgroundColor: '#FF8A4C', width: '100%', paddingVertical: 15, borderRadius: 25, alignItems: 'center', marginBottom: 15 },
  btnOrangeText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  btnGray: { backgroundColor: '#B0B0B0', width: '100%', paddingVertical: 15, borderRadius: 25, alignItems: 'center' },
  btnGrayText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  mapContainer: { flex: 1, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e0e0e0', marginBottom: 20 },
  map: { width: '100%', height: '100%' },
  fullScreenHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 40 : 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  fullScreenTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  emergencyItemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F9F9', padding: 15, borderRadius: 16, marginHorizontal: 20, marginBottom: 12, borderWidth: 1, borderColor: '#eee' },
  customEmergencyIcon: { width: 50, height: 50, resizeMode: 'contain' },
  emergencyTextContainer: { flex: 1, marginLeft: 15 },
  emergencyName: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 2 },
  emergencyDesc: { fontSize: 12, color: '#888' },
  emergencyPhone: { fontSize: 13, color: '#FF8A4C', fontWeight: 'bold', marginTop: 2 },
  selectButtonText: { color: '#007AFF', fontSize: 14, fontWeight: 'bold', marginLeft: 10 },
  footer: {
    position: 'absolute',
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    height: 80,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingBottom: 15
  },
  footerButton: { padding: 10, flex: 1, alignItems: 'center' },
  footerIcon: { width: 25, height: 25 },

  // ✅ Style สำหรับ Modal ออกจากระบบ
  logoutModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 30,
    alignItems: 'center',
    paddingBottom: 50,
  },
  logoutIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#FFE5E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 5,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  logoutTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  logoutSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  btnRed: {
    backgroundColor: '#FF3B30',
    width: '100%',
    paddingVertical: 15,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  btnRedText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
