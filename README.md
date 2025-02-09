# Vocabulary Learning System

This repository implements a comprehensive vocabulary learning and review system consisting of two main components:

- **Backend API:** Built with Fastify and SQLite for managing vocabularies, reviews, and learning progress.
- **Frontend Client:** Built with React and Vite, providing an interactive interface for vocabulary quizzes and history tracking.

## Project Structure

**Backend (API)**
- **`/api` Directory:**
  - **`src/config/learning.js`**: Contains learning configuration (daily new words, review limits, Ebbinghaus review intervals, etc.).
  - **`src/routes/vocab.js` & `src/routes/review.js`**: Define API endpoints for vocabulary management and review sessions.
  - **`src/services/vocab.js` & `src/services/review.js`**: Business logic for processing vocabulary data and managing spaced repetition.
  - **`src/db/init.js`**: Initializes the SQLite database with tables for vocabularies, learning records, and progress.
  - **`src/cli.js`**: Command-line tool for importing/exporting vocabulary data from/to JSON files.
  
**Frontend (@Web)**
- **`@Web` Directory:**
  - **`src/pages/LearningPage.jsx`**: The main page where users study vocabularies via quizzes.
  - **`src/pages/HistoryPage.jsx`**: Displays history and statistics of learning sessions.
  - **`src/stores/useVocabStore.js`**: Zustand store for state management.
  - **Other configurations** include Vite for development, Tailwind CSS and DaisyUI for styling, and ESLint for code quality.

## Getting Started

### Prerequisites
- Node.js (v14 or later)
- npm or yarn

### Backend Setup

1. **Install Dependencies:**
   ```bash
   cd api
   npm install
   ```
2. **Start the API Server:**
   ```bash
   node src/app.js
   ```
   The API server will start on [http://localhost:3000](http://localhost:3000).  
   You can view the API documentation at [http://localhost:3000/documentation](http://localhost:3000/documentation).

3. **Vocabulary Data Management:**
   - **Import Data:**
     ```bash
     node src/cli.js import path/to/vocabularies.json
     ```
   - **Export Data:**
     ```bash
     node src/cli.js export path/to/output.json
     ```

### Frontend Setup

1. **Install Dependencies:**
   ```bash
   cd @Web
   npm install
   ```
2. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   The web client will run at [http://127.0.0.1:5173](http://127.0.0.1:5173).

## Features

- **Vocabulary Management:** Create, update, and delete vocabularies with integrated import/export functionality.
- **Spaced Repetition:** Built-in scheduling for daily new words and review sessions based on configurable intervals.
- **Interactive Quizzes:** Multiple-choice questions to test vocabulary retention.
- **Learning History:** Detailed tracking of progress, review counts, and correctness for each vocabulary over time.

## Technologies Used

- **Backend:** Fastify, SQLite, Day.js
- **Frontend:** React, Vite, Zustand, Tailwind CSS, DaisyUI

## License

This project is licensed under the MIT License.

## Contributing

Contributions are welcome! Please open issues or submit pull requests if you have suggestions or bug fixes.
