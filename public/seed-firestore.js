#!/usr/bin/env node

/**
 * Firestore Seeding Script for QUIZMO
 * 
 * This script seeds the Firestore database with sample quiz questions.
 * It uses Firebase client SDK with anonymous authentication, which works
 * well for seeding operations without requiring service account keys.
 * 
 * Usage:
 *   npm run seed
 *   # or
 *   node scripts/seed-firestore.js
 * 
 * Requirements:
 *   - .env file with Firebase configuration
 *   - Firebase project with Firestore enabled
 *   - Anonymous authentication enabled in Firebase Console
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, signInAnonymously, connectAuthEmulator } from 'firebase/auth';

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Validate required environment variables
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  console.error('\n📝 Please create a .env file based on .env.example');
  process.exit(1);
}

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Sample questions data
const sampleQuestions = [
];

/**
 * Seed the Firestore database with sample questions
 */
async function seedFirestore() {
  try {
    console.log('🔥 Initializing Firebase...');
    
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    
    // Check if we should use emulator (for development)
    const useEmulator = process.env.NODE_ENV === 'development' || process.env.USE_EMULATOR === 'true';
    
    if (useEmulator) {
      console.log('🧪 Using Firebase emulators...');
      try {
        connectAuthEmulator(auth, "http://localhost:9099");
        connectFirestoreEmulator(db, 'localhost', 8080);
      } catch (error) {
        // Emulators might already be connected
        console.log('⚠️  Emulator connection may already exist');
      }
    }
    
    console.log('🔐 Authenticating anonymously...');
    
    // Sign in anonymously
    const userCredential = await signInAnonymously(auth);
    console.log('✅ Successfully authenticated as:', userCredential.user.uid);
    
    console.log('📝 Starting to seed questions...');
    
    // Get reference to questions collection
    const questionsCollection = collection(db, 'questions');
    
    // Add each question to Firestore
    const promises = sampleQuestions.map(async (question, index) => {
      try {
        const docRef = await addDoc(questionsCollection, question);
        console.log(`   ✅ Added question ${index + 1}/${sampleQuestions.length}: "${question.question.substring(0, 50)}..."`);
        return docRef.id;
      } catch (error) {
        console.error(`   ❌ Failed to add question ${index + 1}:`, error.message);
        throw error;
      }
    });
    
    // Wait for all questions to be added
    const docIds = await Promise.all(promises);
    
    console.log('\n🎉 Successfully seeded Firestore database!');
    console.log(`📊 Added ${docIds.length} questions to the 'questions' collection`);
    console.log('\n📋 Summary:');
    
    // Print summary by category
    const categoryCounts = sampleQuestions.reduce((acc, q) => {
      acc[q.category] = (acc[q.category] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(categoryCounts).forEach(([category, count]) => {
      console.log(`   - ${category}: ${count} questions`);
    });
    
    console.log('\n🚀 Your QUIZMO app is now ready with sample questions!');
    console.log('   You can start hosting quiz rooms and testing the app.');
    
    // Sign out
    await auth.signOut();
    console.log('\n👋 Signed out successfully');
    
  } catch (error) {
    console.error('\n❌ Error seeding Firestore:', error);
    
    if (error.code === 'auth/operation-not-allowed') {
      console.error('\n🔧 Fix: Enable Anonymous Authentication in Firebase Console:');
      console.error('   1. Go to Firebase Console > Authentication > Sign-in method');
      console.error('   2. Enable "Anonymous" sign-in provider');
      console.error('   3. Run this script again');
    } else if (error.code === 'permission-denied') {
      console.error('\n🔧 Fix: Update Firestore security rules to allow writes:');
      console.error('   1. Go to Firebase Console > Firestore Database > Rules');
      console.error('   2. Ensure authenticated users can write to questions collection');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('network')) {
      console.error('\n🔧 Fix: Check your internet connection and Firebase project ID');
    }
    
    process.exit(1);
  }
}

/**
 * Load questions from external JSON file (optional)
 */
function loadQuestionsFromFile(filePath) {
  try {
    const fullPath = join(__dirname, filePath);
    const fileContent = readFileSync(fullPath, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.log(`ℹ️  Could not load questions from ${filePath}, using default questions`);
    return sampleQuestions;
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const helpFlag = args.includes('--help') || args.includes('-h');
const fileFlag = args.find(arg => arg.startsWith('--file='));

if (helpFlag) {
  console.log(`
🔥 QUIZMO Firestore Seeding Script

Usage:
  npm run seed                    Seed with default questions
  node scripts/seed-firestore.js  Seed with default questions
  npm run seed -- --file=path    Seed with questions from JSON file
  npm run seed -- --help         Show this help

Environment Variables:
  NODE_ENV=development            Use Firebase emulators
  USE_EMULATOR=true              Force use of emulators

Requirements:
  - .env file with Firebase configuration
  - Anonymous authentication enabled in Firebase
  - Firestore database created
  `);
  process.exit(0);
}

// Load questions from file if specified
let questionsToSeed = sampleQuestions;
if (fileFlag) {
  const filePath = fileFlag.split('=')[1];
  questionsToSeed = loadQuestionsFromFile(filePath);
}

// Update the sample questions if loaded from file
if (questionsToSeed !== sampleQuestions) {
  console.log(`📁 Loading questions from external file...`);
  sampleQuestions.length = 0;
  sampleQuestions.push(...questionsToSeed);
}

// Run the seeding script
console.log('🎯 QUIZMO Firestore Seeding Script');
console.log('================================\n');

seedFirestore().catch(console.error);
