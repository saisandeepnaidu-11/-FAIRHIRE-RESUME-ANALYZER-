import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

type FirebaseContextType = {
  user: any;
  profile: any;
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
};

const FirebaseContext = createContext<FirebaseContextType>({} as any);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch or create user profile in Firestore
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            setProfile(userDocSnap.data());
          } else {
            const newProfile = {
              name: currentUser.displayName || 'Recruiter',
              role: 'Talent Acquisition',
              photoURL: currentUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.uid}`,
              email: currentUser.email,
              createdAt: new Date().toISOString()
            };
            await setDoc(userDocRef, newProfile);
            setProfile(newProfile);
          }
        } catch (err) {
          console.error("Error setting/getting user profile:", err);
          // Fallback to local profile without crashing if Firestore rules or schema blocks it
          setProfile({
            name: currentUser.displayName || 'Recruiter',
            role: 'Talent Acquisition',
            photoURL: currentUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.uid}`,
            email: currentUser.email
          });
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    try {
      setLoading(true);
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Google Sign-In Error:", err);
      setLoading(false);
      throw err;
    }
  };
  
  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout Error:", err);
    }
  };

  return (
    <FirebaseContext.Provider value={{ user, profile, loading, signIn, logout }}>
      {children}
    </FirebaseContext.Provider>
  );
}

export const useFirebase = () => useContext(FirebaseContext);

