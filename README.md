# FairHire AI 🚀

**Empowering Fair and Efficient Talent Acquisition with AI.**

FairHire AI is a modern talent acquisition platform designed to streamline the recruitment process while actively reducing unconscious bias. By leveraging Gemini AI and a robust React-Firebase architecture, FairHire AI helps organizations find the best talent based on merit and potential.

---

## ✨ Key Features

- **AI-Powered Resume Analysis**: Automatically extract skills, experience, and key metrics from resumes using Google's Gemini AI.
- **Bias Reduction Engine**: Dynamic tools to anonymize candidate data and focus on objective scoring criteria.
- **Smart Interview Question Generation**: Context-aware interview questions tailored to specific job roles and candidate backgrounds.
- **Candidate Analytics Dashboard**: Visualize candidate pipelines and performance metrics with Recharts.
- **Secure Authentication**: Integrated Firebase Auth for secure recruiter and admin access.
- **Export Capabilities**: Generate professional candidate reports in PDF and DOCX formats.

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS 4.0
- **Backend/Server**: Node.js, Express, tsx
- **AI**: Google Gemini AI (@google/genai)
- **Database & Auth**: Firebase (Firestore, Authentication)
- **Styling & UI**: Lucide Icons, Framer Motion (motion), Tailgrid
- **Charts**: Recharts
- **Document Processing**: jspdf, pdf-parse, docx

## 🚀 Getting Started

### Prerequisites

- Node.js (Latest LTS recommended)
- Firebase Project
- Google AI (Gemini) API Key

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd fairhire-ai
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory and add the following:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_GEMINI_API_KEY=your_gemini_api_key
   ```
   *Note: See `.env.example` for a complete list.*

### Running the Application

To start the development server (runs both the frontend and the backend via `tsx`):

```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

## 📁 Project Structure

- `src/`: React application source code.
  - `lib/`: Firebase and Gemini configurations.
- `server.ts`: Express server logic for handling AI and document processing.
- `firestore.rules`: Security rules for the Firebase database.
- `vite.config.ts`: Vite configuration.

## 📝 License

This project is licensed under the MIT License.
