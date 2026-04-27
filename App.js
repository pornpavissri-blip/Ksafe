import React, { useState } from 'react';
import WelcomeScreen from './WelcomeScreen';
import WelcomeScreen2 from './WelcomeScreen2';
import WelcomeScreen3 from './WelcomeScreen3'; 
import Login from './login'; 
import Register from './Register'; 
import OtpScreen from './OtpScreen'; 
import Success from './Success'; 
import HomeScreen from './HomeScreen';
import SearchScreen from './SearchScreen';
import DetailScreen from './DetailScreen';
import SosScreen from './sos'; 
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';
import ProfileScreen from './ProfileScreen';
import MapScreen from './MapScreen';
import AdminHomeScreen from './AdminHomeScreen';
import ManageContactScreen from './ManageContactScreen';
import ManageFacilitiesScreen from './ManageFacilitiesScreen'; 
import ManageUserScreen from './ManageUserScreen'; 

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('Welcome1');
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [tempUserData, setTempUserData] = useState(null);
  const [resetPhone, setResetPhone] = useState(''); 
  const [userPhone, setUserPhone] = useState(''); 
  const [userRole, setUserRole] = useState('');   

  const navigateTo = {
    home: () => setCurrentScreen('Home'),
    sos: () => setCurrentScreen('SOS'),
    search: () => setCurrentScreen('Search'),
    profile: () => setCurrentScreen('Profile'),
    admin: () => setCurrentScreen('AdminHome'),
    manageContact: () => setCurrentScreen('ManageContact'), 
    manageFacilities: () => setCurrentScreen('ManageFacilities'),
    manageUser: () => setCurrentScreen('ManageUser'), 
  };

  // --- 1. Welcome Screens ---
  if (currentScreen === 'Welcome1') return <WelcomeScreen onNext={() => setCurrentScreen('Welcome2')} />;
  if (currentScreen === 'Welcome2') return <WelcomeScreen2 onNext={() => setCurrentScreen('Welcome3')} onBack={() => setCurrentScreen('Welcome1')} />;
  if (currentScreen === 'Welcome3') return <WelcomeScreen3 onNext={() => setCurrentScreen('Login')} onBack={() => setCurrentScreen('Welcome2')} />;

  // --- 2. Auth Screens (Login / Register / OTP) ---
  if (currentScreen === 'Login') {
    return (
      <Login 
        onLogin={(role, phone) => {
          setUserRole(role);
          setUserPhone(phone);
          if (role === 'admin') navigateTo.admin();
          else navigateTo.home();
        }} 
        onRegister={() => setCurrentScreen('Register')} 
        onForgotPassword={() => setCurrentScreen('ForgotPassword')} 
      />
    );
  }
  
  if (currentScreen === 'Register') {
    return <Register onBack={() => setCurrentScreen('Login')} onNext={(data) => { setTempUserData(data); setCurrentScreen('Otp'); }} />;
  }

  if (currentScreen === 'Otp') {
    return <OtpScreen userData={tempUserData} onBack={() => setCurrentScreen('Register')} onVerifySuccess={() => setCurrentScreen('Success')} />;
  }

  if (currentScreen === 'Success') return <Success onNext={() => setCurrentScreen('Login')} />;

  // --- 3. Forgot Password Flow ---
  if (currentScreen === 'ForgotPassword') {
    return (
      <ForgotPassword 
        onBack={() => setCurrentScreen('Login')} 
        onNext={(phoneNumber) => { 
          setResetPhone(phoneNumber); 
          setCurrentScreen('ForgotOtp'); 
        }} 
      />
    );
  }

  if (currentScreen === 'ForgotOtp') {
    return (
      <OtpScreen 
        userData={{ phone: resetPhone }} 
        onBack={() => setCurrentScreen('ForgotPassword')} 
        onVerifySuccess={() => setCurrentScreen('ResetPassword')} 
      />
    );
  }

  if (currentScreen === 'ResetPassword') {
    return (
      <ResetPassword 
        phoneNumber={resetPhone} 
        onBack={() => setCurrentScreen('ForgotOtp')} 
        onResetSuccess={() => { setResetPhone(''); setCurrentScreen('Login'); }} 
        onNext={() => { setResetPhone(''); setCurrentScreen('Login'); }}
      />
    );
  }

  // --- 4. Admin Screens ---
  if (currentScreen === 'AdminHome') {
    return (
      <AdminHomeScreen 
        onLogout={() => setCurrentScreen('Login')} 
        onGoHome={navigateTo.admin} 
        onGoSOS={navigateTo.manageContact} 
        onGoSearch={navigateTo.manageFacilities} 
        onGoProfile={navigateTo.manageUser} 
        onManageFacilities={navigateTo.manageFacilities} 
      />
    );
  }

  if (currentScreen === 'ManageContact') {
    return <ManageContactScreen onGoHome={navigateTo.admin} onGoSOS={navigateTo.manageContact} onGoSearch={navigateTo.manageFacilities} onGoProfile={navigateTo.manageUser} />;
  }

  if (currentScreen === 'ManageFacilities') {
    return <ManageFacilitiesScreen onGoHome={navigateTo.admin} onGoSOS={navigateTo.manageContact} onGoSearch={navigateTo.manageFacilities} onGoProfile={navigateTo.manageUser} />;
  }

  if (currentScreen === 'ManageUser') {
    return <ManageUserScreen onGoHome={navigateTo.admin} onGoSOS={navigateTo.manageContact} onGoSearch={navigateTo.manageFacilities} onGoProfile={navigateTo.manageUser} />;
  }

  // --- 5. Main App Screens (User) ---
  if (currentScreen === 'Search') {
    return (
      <SearchScreen 
        onBack={navigateTo.home} 
        currentUserPhone={userPhone}
        onGoHome={navigateTo.home}
        onGoSOS={navigateTo.sos}
        onGoSearch={navigateTo.search}
        onGoProfile={navigateTo.profile} 
        goToDetail={(placeData) => { setSelectedPlace(placeData); setCurrentScreen('Detail'); }} 
      />
    );
  }

  if (currentScreen === 'Detail') {
    return <DetailScreen data={selectedPlace} onBack={() => setCurrentScreen('Search')} onPressMap={() => setCurrentScreen('Map')} />;
  }

  if (currentScreen === 'Map') {
    return (
      <MapScreen 
        onBack={() => setCurrentScreen('Detail')} 
        destinationName={selectedPlace?.ชื่อ || selectedPlace?.name || "จุดหมายปลายทาง"} 
        destinationCoords={selectedPlace?.พิกัด || { latitude: selectedPlace?.latitude, longitude: selectedPlace?.longitude }}
      />
    );
  }

  if (currentScreen === 'SOS') {
    return <SosScreen onCancel={navigateTo.home} onGoHome={navigateTo.home} onGoSearch={navigateTo.search} onGoProfile={navigateTo.profile} />;
  }

  if (currentScreen === 'Profile') {
    return (
      <ProfileScreen 
        currentUserPhone={userPhone}
        onGoHome={userRole === 'admin' ? navigateTo.admin : navigateTo.home}
        onGoSOS={userRole === 'admin' ? navigateTo.manageContact : navigateTo.sos}
        onGoSearch={userRole === 'admin' ? navigateTo.manageFacilities : navigateTo.search}
        onGoProfile={navigateTo.profile}
        onLogout={() => { setUserRole(''); setUserPhone(''); setCurrentScreen('Login'); }} 
      />
    );
  }

  // Default Screen: Home Screen (User)
  return (
    <HomeScreen
      currentUserPhone={userPhone}
      onGoHome={navigateTo.home}
      onGoSOS={navigateTo.sos}
      onGoSearch={navigateTo.search}
      onGoProfile={navigateTo.profile}
    />
  );
}
