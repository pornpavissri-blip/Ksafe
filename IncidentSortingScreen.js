import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Dimensions, ActivityIndicator, TouchableOpacity, FlatList, Platform } from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import { db } from './firebaseConfig'; 
import { collection, onSnapshot, query } from 'firebase/firestore';

const { width } = Dimensions.get('window');

// ⚠️ ใช้ Key เดียวกันกับที่คุณใช้ในหน้า MapScreen
const GOOGLE_MAPS_APIKEY = 'AIzaSyCzLA0NWNQk5Iu9AzC0yW1bwQ0Y_KqngSQ'; 

const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function IncidentSortingScreen({ filter, onBack }) {
  const [activeFilter, setActiveFilter] = useState(filter || 'all');
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'incident_reports'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      
      // 1. ดึงข้อมูลทั้งหมดมา 100% และดักจับพิกัดทุกรูปแบบ
      const rawData = snapshot.docs.map(doc => {
        const data = doc.data();
        
        // รองรับกรณีที่เก็บข้อมูลเป็น latitude/longitude ปกติ
        let lat = data.latitude !== undefined ? parseFloat(data.latitude) : NaN;
        let lng = data.longitude !== undefined ? parseFloat(data.longitude) : NaN;

        // รองรับกรณีที่เก็บเป็น GeoPoint ในชื่อ field 'location' (เผื่อไว้)
        if (data.location && typeof data.location.latitude === 'number') {
            lat = data.location.latitude;
            lng = data.location.longitude;
        }

        return {
          id: doc.id,
          ...data,
          lat: lat,
          lng: lng
        };
      });

      const radiusKm = 1.0; 

      // 2. คำนวณความเสี่ยง
      const processedData = rawData.map((item, _, arr) => {
        let nearbyCount = 0;
        const hasCoords = !isNaN(item.lat) && !isNaN(item.lng);
        
        if (hasCoords) {
          for (let i = 0; i < arr.length; i++) {
            const otherItem = arr[i];
            
            if (isNaN(otherItem.lat) || isNaN(otherItem.lng)) continue;
            if (Math.abs(item.lat - otherItem.lat) > 0.015 || Math.abs(item.lng - otherItem.lng) > 0.015) {
              continue;
            }

            const distance = getDistanceFromLatLonInKm(item.lat, item.lng, otherItem.lat, otherItem.lng);
            if (distance <= radiusKm) {
              nearbyCount++; 
            }
          }
        }

        let sev = 'low';
        if (nearbyCount >= 20) {
          sev = 'high';
        } else if (nearbyCount >= 5) {
          sev = 'medium';
        }

        return { ...item, severity: sev, nearbyCount, hasCoords };
      });

      setIncidents(processedData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredData = useMemo(() => {
    if (activeFilter === 'all') return incidents;
    return incidents.filter(item => item.severity === activeFilter);
  }, [incidents, activeFilter]);

  const getStyle = (sev) => {
    switch (sev) {
      case 'high': return { color: 'rgba(239, 68, 68, 0.4)', solid: '#EF4444', label: 'เสี่ยงสูง' };
      case 'medium': return { color: 'rgba(245, 158, 11, 0.4)', solid: '#F59E0B', label: 'ปานกลาง' };
      case 'low': 
      default: return { color: 'rgba(250, 204, 21, 0.4)', solid: '#FACC15', label: 'เฝ้าระวัง' };
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}><ArrowLeft color="#111" size={24} /></TouchableOpacity>
        <Text style={styles.headerTitle}>สรุปพิกัดแยกประเภท</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.mapWrapper}>
        <MapView
          provider={PROVIDER_GOOGLE} 
          style={styles.map}
          apikey={GOOGLE_MAPS_APIKEY} 
          initialRegion={{
            latitude: 14.9071,
            longitude: 102.0040,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          }}
        >
          {filteredData.filter(item => item.hasCoords).map((item) => {
            const config = getStyle(item.severity);
            return (
              <React.Fragment key={`map-${item.id}`}>
                <Circle 
                  center={{ latitude: item.lat, longitude: item.lng }} 
                  radius={400} 
                  fillColor={config.color} 
                  strokeColor="transparent" 
                />
                <Marker coordinate={{ latitude: item.lat, longitude: item.lng }}>
                   <View style={[styles.markerDot, { backgroundColor: config.solid }]} />
                </Marker>
              </React.Fragment>
            );
          })}
        </MapView>
      </View>

      <View style={styles.tabContainer}>
        {['all', 'high', 'medium', 'low'].map((type) => (
          <TouchableOpacity 
            key={type} 
            onPress={() => setActiveFilter(type)}
            style={[styles.tab, activeFilter === type && { borderColor: getStyle(type).solid, backgroundColor: getStyle(type).solid + '15' }]}
          >
            <View style={[styles.dot, { backgroundColor: getStyle(type).solid }]} />
            <Text style={[styles.tabText, activeFilter === type && { color: getStyle(type).solid, fontWeight: 'bold' }]}>
              {type === 'all' ? 'ทั้งหมด' : getStyle(type).label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <ActivityIndicator size="large" color="#F7934C" style={{ marginTop: 50 }} /> : (
        <FlatList
          data={filteredData}
          keyExtractor={item => String(item.id)}
          style={{ flex: 1 }} // เพิ่ม flex: 1 ให้กางเต็มพื้นที่
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }} // 💡 เพิ่ม paddingBottom 100 ดันข้อมูลไม่ให้จมขอบจอ
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={[styles.sideLine, { backgroundColor: getStyle(item.severity).solid }]} />
              <View style={styles.cardInfo}>
                <Text style={styles.cardId}>ID-{item.id.substring(0, 5)} <Text style={styles.cardTitle}>{item.service_name}</Text></Text>
                <Text style={styles.subText}>
                  📍 {item.hasCoords ? `${item.lat}, ${item.lng} (พบ ${item.nearbyCount} ครั้งในพื้นที่)` : 'ไม่ระบุพิกัดในระบบ'}
                </Text>
              </View>
              <ChevronRight size={18} color="#D1D5DB" />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, backgroundColor: '#FFF', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: 'bold' },
  mapWrapper: { marginHorizontal: 20, height: 250, borderRadius: 25, overflow: 'hidden', backgroundColor: '#EEE', marginTop: 10, elevation: 4 },
  map: { ...StyleSheet.absoluteFillObject },
  markerDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: '#FFF' },
  tabContainer: { flexDirection: 'row', padding: 15, gap: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 20, borderWidth: 1, borderColor: '#EEE', backgroundColor: '#FFF' },
  tabText: { fontSize: 11, marginLeft: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 15, borderRadius: 20, marginBottom: 12, elevation: 1 },
  sideLine: { width: 4, height: 35, borderRadius: 10 },
  cardInfo: { flex: 1, marginLeft: 15 },
  cardId: { fontSize: 11, color: '#F7934C', fontWeight: 'bold' },
  cardTitle: { color: '#333', fontWeight: 'bold' },
  subText: { fontSize: 11, color: '#999' }
});
