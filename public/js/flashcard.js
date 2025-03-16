class FlashcardManager {
  constructor() {
    this.activeFlashcards = [];
    this.maxFlashcards = 3; // Maximum number of flashcards visible at once
  }

  // Show flashcard
  show(type, message, title, duration = 5000) {
    const flashcard = document.createElement('div');
    flashcard.className = `flashcard ${type} visible`; // Add visible class
    
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    
    flashcard.innerHTML = `
      <div class="flashcard-icon">
        <i class="fas ${icon}"></i>
      </div>
      <div class="flashcard-content">
        <h3>${title}</h3>
        <p>${message}</p>
      </div>
      <button class="flashcard-close">
        <i class="fas fa-times"></i>
      </button>
    `;
    
    document.body.appendChild(flashcard);
    this.activeFlashcards.push(flashcard);
    
    // Reposition existing flashcards
    this.positionFlashcards();
    
    // Remove excess flashcards
    if (this.activeFlashcards.length > this.maxFlashcards) {
      this.dismiss(this.activeFlashcards[0]);
    }
    
    // Set auto-dismiss timer
    setTimeout(() => {
      if (document.body.contains(flashcard)) {
        this.dismiss(flashcard);
      }
    }, duration);
    
    // Add close button handler
    const closeBtn = flashcard.querySelector('.flashcard-close');
    closeBtn.addEventListener('click', () => {
      this.dismiss(flashcard);
    });
    
    return flashcard;
  }
  
  // Dismiss flashcard
  dismiss(flashcard) {
    flashcard.classList.add('hide');
    flashcard.classList.remove('visible');
    
    // Remove from DOM after animation completes
    setTimeout(() => {
      if (document.body.contains(flashcard)) {
        document.body.removeChild(flashcard);
        this.activeFlashcards = this.activeFlashcards.filter(card => card !== flashcard);
        this.positionFlashcards();
      }
    }, 300); // Match animation duration
  }
  
  // Position flashcards vertically
  positionFlashcards() {
    let offset = 20;
    this.activeFlashcards.forEach((card, index) => {
      card.style.top = `${offset}px`;
      offset += card.offsetHeight + 10; // Add margin between cards
    });
  }
  
  // Show success flashcard
  success(message, title = 'Success') {
    return this.show('success', message, title);
  }
  
  // Show error flashcard
  error(message, title = 'Error') {
    return this.show('error', message, title);
  }
}

// Initialize flashcard manager
const flashcards = new FlashcardManager();

// Form handling
document.addEventListener('DOMContentLoaded', function() {
  // If on signup page
  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(signupForm);
      try {
        const response = await fetch('/signup', {
          method: 'POST',
          body: new URLSearchParams(formData),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
          flashcards.success(result.message, 'Registration Successful!');
          // Redirect after showing message
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
        } else {
          flashcards.error(result.message, 'Registration Failed');
        }
      } catch (error) {
        flashcards.error('An error occurred. Please try again.', 'Registration Failed');
        console.error('Error:', error);
      }
    });
  }
  
  // If on login page
  const loginForm = document.querySelector('form[action="/login"]');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(loginForm);
      try {
        const response = await fetch('/login', {
          method: 'POST',
          body: new URLSearchParams(formData),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
          flashcards.success(result.message, 'Login Successful!');
          // Redirect after showing message
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
        } else {
          flashcards.error(result.message, 'Login Failed');
        }
      } catch (error) {
        flashcards.error('An error occurred. Please try again.', 'Login Failed');
        console.error('Error:', error);
      }
    });
  }
});