const emailChars = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const lowerCaseLetters = /[a-z]/;
const upperCaseLetters = /[A-Z]/;
const specialCharacters = /[!@#$%^&*(),.?":{}|<>]/;
const numberCharacters = /[0-9]/;

const registerBtn = document.getElementById("register-btn");
const password = document.getElementById("password");
const cpassword = document.getElementById("cpassword");

function validateField(id, errorId, errorMessage) {
  let field = document.getElementById(id);
  let errorLabel = document.getElementById(errorId);

  if (field.value.trim() === "") {
    errorLabel.textContent = "❌ " + errorMessage;
    errorLabel.className = "invalid-feedback";
    field.style.border = "2px solid red";
  } else {
    errorLabel.textContent = "✅";
    errorLabel.className = "valid-feedback";
    field.style.border = "2px solid green";
  }
  checkFormValidity();
}

function checkFormValidity() {
  const allFieldsValid = [...document.querySelectorAll(".input")].every(field => 
    field.style.border === "2px solid green"
  );
  registerBtn.disabled = !allFieldsValid;
}

function nameCheck() {
  validateField("name", "FirstNameForm", "Name must be at least 3 characters long");
}

function emailCheck() {
  let email = document.getElementById("email");
  let errorLabel = document.getElementById("emailForms");

  if (email.value.trim() === "" || !emailChars.test(email.value)) {
    errorLabel.textContent = "❌ Enter a valid email address";
    errorLabel.className = "invalid-feedback";
    email.style.border = "2px solid red";
  } else {
    errorLabel.textContent = "✅";
    errorLabel.className = "valid-feedback";
    email.style.border = "2px solid green";
  }
  checkFormValidity();
}

function passwordCheck() {
  let errorLabel = document.getElementById("passwordForm");

  if (password.value.length < 8) {
    errorLabel.textContent = "❌ Password must be at least 8 characters";
  } else if (!lowerCaseLetters.test(password.value) || !upperCaseLetters.test(password.value)) {
    errorLabel.textContent = "❌ Must contain uppercase & lowercase letters";
  } else if (!specialCharacters.test(password.value)) {
    errorLabel.textContent = "❌ Must include at least one special character";
  } else if (!numberCharacters.test(password.value)) {
    errorLabel.textContent = "❌ Must include at least one number";
  } else {
    errorLabel.textContent = "✅";
    password.style.border = "2px solid green";
    checkFormValidity();
    return;
  }
  errorLabel.className = "invalid-feedback";
  password.style.border = "2px solid red";
  checkFormValidity();
}

function finalPasswordCheck() {
  let errorLabel = document.getElementById("cpasswordform");

  if (cpassword.value !== password.value) {
    errorLabel.textContent = "❌ Passwords do not match";
    errorLabel.className = "invalid-feedback";
    cpassword.style.border = "2px solid red";
  } else {
    errorLabel.textContent = "✅";
    cpassword.style.border = "2px solid green";
  }
  checkFormValidity();
}

function addressCheck() {
  validateField("street", "streetForm", "Street cannot be blank");
  validateField("city", "cityForm", "City cannot be blank");
  validateField("state", "stateForm", "State cannot be blank");
  validateField("postalCode", "postalCodeForm", "Postal Code cannot be blank");
  validateField("country", "countryForm", "Country cannot be blank");
}

// Password Toggle Functionality
function setupPasswordToggle(toggleId, inputId) {
  const toggle = document.getElementById(toggleId);
  const input = document.getElementById(inputId);
  const icon = toggle.querySelector('i');

  toggle.addEventListener('click', function () {
    const type = input.type === 'password' ? 'text' : 'password';
    input.type = type;
    icon.classList.toggle('fa-eye');
    icon.classList.toggle('fa-eye-slash');
  });
}

setupPasswordToggle("password-toggle", "password");
setupPasswordToggle("cpassword-toggle", "cpassword");

// Apply Event Listeners Dynamically
document.querySelectorAll(".input").forEach(input => {
  input.addEventListener("input", () => {
    switch (input.id) {
      case "name": nameCheck(); break;
      case "email": emailCheck(); break;
      case "password": passwordCheck(); break;
      case "cpassword": finalPasswordCheck(); break;
      case "street":
      case "city":
      case "state":
      case "postalCode":
      case "country":
        addressCheck();
        break;
    }
  });
});
