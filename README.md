# MeetTheMakers – A Peer-to-Peer Marketplace Platform

**MeetTheMakers** is a web-based peer-to-peer (P2P) marketplace platform designed to facilitate direct interaction between buyers and sellers. The application allows users to either post specific requirements for goods or services or to showcase their own offerings through structured listings and blog-style posts.

This project was developed as part of the Software Project Development curriculum at CHRIST (Deemed to be University), demonstrating practical implementation of full-stack web development using cloud-based database services.

---

## 🔗 Live Application

- **Hosted on:** [Vercel]([https://vercel.com/arun-m-ps-projects/meetthemakers-app])  
- **Live URL:** [https://www.meetthemakers.shop/]
- **Database:** Azure Cosmos DB (MongoDB API)

---

## 📌 Objective

The primary objective of this project is to design and implement a decentralized platform that minimizes the reliance on intermediaries and enables efficient, direct transactions between users. Unlike traditional marketplaces, this platform provides mechanisms for both product/service showcasing and requirement-based posting, creating a dynamic and user-driven commercial environment.

---

## 🔍 Key Features

- **User Registration and Authentication**  
  Secure user management using JWT-based authentication with password hashing and session handling.

- **Requirement Posting (Buyers)**  
  Buyers can post customized needs for products or services, enabling sellers to respond proactively.

- **Product/Service Showcase (Sellers)**  
  Sellers can list their offerings through detailed blog-style posts including descriptions, pricing, and media.

- **Blog Module with Interaction**  
  Enables comment-based engagement on seller posts to improve buyer-seller interaction.

- **E-Commerce Functionality**  
  Product listings, add-to-cart features, and order summaries are supported (note: payment integration is not included).

- **Administrative Panel**  
  Admins can monitor user activity, moderate content, and enforce platform rules to ensure compliance and security.

---

## 💡 Unique Aspects

MeetTheMakers introduces several features that distinguish it from existing platforms:

| Feature                          | Availability            |
|----------------------------------|--------------------------|
| Buyer-driven requirement posting | ✅ Supported             |
| Seller blog-style product posts  | ✅ Supported             |
| Administrative content control   | ✅ Supported             |


---

## 🏗️ Technology Stack

| Layer        | Technology                     |
|--------------|---------------------------------|
| **Frontend** | HTML5, CSS3                    |
| **Backend**  | Node.js, Express.js             |
| **Database** | Azure Cosmos DB (MongoDB API)  |
| **Hosting**  | Vercel                         |
| **Security** | JWT-based authentication        |

---

## 🧩 System Modules

### 1. Authentication Module
- Secure sign-up and sign-in
- Form input validation
- Session handling using JWT tokens

### 2. Requirement Posting (Buyer Module)
- Structured input: Title, description, quantity, price
- Publicly viewable listings
- Accessible to all registered users

### 3. Blog Module (Seller Showcase)
- Sellers create blog posts featuring offerings
- Includes product images, descriptions, pricing
- Comment section available for interaction

### 4. E-Commerce Module
- Product catalog management
- Add to cart and order preview functionality
- No third-party payment processor integration

### 5. Administrative Panel
- User listing and moderation
- Post review and control
- Security and activity monitoring

---

## ☁️ Database: Azure Cosmos DB

The platform utilizes Azure Cosmos DB with the MongoDB API for scalable, globally distributed NoSQL database services. It stores:

- User credentials and profiles
- Requirement posts
- Product and blog posts
- Comments and system logs

---

## 🚀 Deployment

The platform is deployed using [Vercel](https://vercel.com/), which supports:

- Continuous integration with GitHub
- Automatic builds and deployments
- Global CDN distribution
- Free HTTPS and domain management

---

## 🧪 Local Development Setup

### Prerequisites

- Node.js
- NPM
- Git

### Steps

```bash
# Clone the repository
git clone https://github.com/your-username/meetthemakers.git
cd meetthemakers

# Install backend dependencies
npm install

# Configure environment variables
touch .env
