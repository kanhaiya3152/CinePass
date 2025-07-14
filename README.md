# 🎟️ CinePass - Movie Ticket Booking App

CinePass is a full-featured **movie ticket booking application** that allows users to browse trending movies, watch trailers, select show timings, and book tickets with secure payment and email confirmations. It features a powerful admin backend for managing shows and movies, all wrapped in a clean and responsive interface.

## 🚀 Features

### 🎬 User Features
- **Browse Trending Movies**: Pulls trending titles from the Trakt API with rich details.
- **Show Selection**: Users can pick show timings and available dates.
- **Movie Details & Trailers**: Detailed movie info and embedded video trailers.
- **Stripe Payment Integration**: Secure and smooth payments using Stripe.
- **Email Confirmation**: Users receive booking confirmation via email.
- **User Authentication**: Login, signup, and session management via Clerk.

### 🛠️ Admin Features
- **Admin Panel**: Manage movies, shows, and booking history.
- **Add Shows**: Create and manage multiple shows for a movie.
- **Event-Driven Webhooks**: Inngest + Svix integration for async workflows.

## 🛠️ Tech Stack

### 🌐 Frontend
- **Framework**: React 
- **Styling**: Tailwind CSS
- **Routing**: React Router Dom
- **Authentication**: Clerk
- **Video**: React Player
- **State/Requests**: Axios, React Context
- **UX Enhancements**: React Hot Toast, Lucide Icons

### 🔙 Backend
- **Server**: Node.js with Express
- **Database**: MongoDB (Mongoose)
- **Authentication**: Clerk (JWT Middleware)
- **Payments**: Stripe
- **Emails**: Nodemailer
- **APIs**: Trakt API, OMDB API
- **Workflows**: Inngest, Svix

## 📥 Installation

### 🔧 Prerequisites
- Node.js and npm
- MongoDB URI
- Clerk API keys
- Stripe API keys
- Trakt & OMDB API credentials

---

### 📦 Backend Setup

```bash
git clone https://github.com/your-username/cinepass.git
cd cinepass/server
npm install
cp .env.example .env     # Add your secrets
npm run dev
