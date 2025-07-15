# QUIZMO - Real-Time Multiplayer Quiz Game

<div align="center">

![QUIZMO Logo](public/icons8-quizizz.svg)

**A real-time multiplayer quiz application built with React and Firebase**


</div>

---

## ✨ Features

### 🎮 **Core Gameplay**
- **Real-time multiplayer quiz sessions** with synchronized timers
- **Room-based system** with unique codes for easy joining
- **Live leaderboard** updates during gameplay
- **Instant answer feedback** with correct answer reveals
- **Final results screen** with player statistics

### 🏗️ **Technical Features**
- **Anonymous authentication** for seamless user experience
- **Real-time synchronization** using Firebase Firestore
- **Responsive design** optimized for all devices
- **TypeScript** for type safety

### 🎯 **Game Features**
- Multiple question categories
- Configurable number of questions per quiz
- Automatic question advancement with timers
- Player performance tracking
- Host controls for game management



## 🏗️ Project Structure

```
quizmo/
├── public/                 # Static assets
├── src/
│   ├── components/        # React components
│   │   ├── HomeScreen.tsx
│   │   ├── QuizScreen.tsx
│   │   ├── Leaderboard.tsx
│   │   └── ...
│   ├── services/          # Firebase & business logic
│   │   ├── auth.ts
│   │   ├── firestore.ts
│   │   ├── quizControl.ts
│   │   └── roomService.ts
│   ├── hooks/             # Custom React hooks
│   ├── config/            # Configuration files
│   └── utils/             # Utility functions
├── scripts/               # Database seeding scripts
└── ...
```

---

## 🎯 How to Play

### For Host:
1. **Create Room** - Set up a new quiz session
2. **Share Code** - Give the room code to players
3. **Start Quiz** - Begin the game when ready
4. **Monitor Progress** - Watch live leaderboard updates
5. **View Results** - Check final rankings and stats

### For Players:
1. **Join Room** - Enter the room code
2. **Wait in Lobby** - See other players joining
3. **Answer Questions** - Submit answers before time runs out
4. **Monitor Progress** - Watch live leaderboard updates
5. **View Results** - Check final rankings and stats



### Tech Stack

- **Frontend**: React
- **Backend**: Firebase (Firestore, Authentication)
- **Build Tool**: Vite
- **Deployment**: render.com
