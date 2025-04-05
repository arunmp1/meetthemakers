// Form handling for login
document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.querySelector('form[action="/login"]');
  const passwordInput = document.getElementById('password')
  const passwordToggle = document.getElementById('password-toggle')
  const passwordIcon = passwordToggle.querySelector('i')


  passwordToggle.addEventListener('click',function(){
    const type = passwordInput.type === 'password' ? 'text':'password'
    passwordInput.type = type;


    if(type === 'password'){
      passwordIcon.classList.remove('fa-eye-slash')
      passwordIcon.classList.add('fa-eye')
    }else{
      passwordIcon.classList.remove('fa-eye')
      passwordIcon.classList.add('fa-eye-slash')
    }
  })


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
            window.location.href = '/profile';
          }, 1000);
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