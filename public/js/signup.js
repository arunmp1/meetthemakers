const emailChars = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const dobField = document.getElementById('dob');
const registerBtn = document.getElementById("register-btn");
const dateForm = document.getElementById('dateForm');
const lowerCaseLetters = /[a-z]/;
const upperCaseLetters = /[A-Z]/;
const specialCharacters = /[!@#$%^&*(),.?":{}|<>]/;



function checkFormValidity(){
  const nameValid = document.getElementById("name").style.border === "2px solid green"
  const emailValid = document.getElementById("email").style.border === "2px solid green"
  const passwordValid = document.getElementById("password").style.border === '2px solid green'
  const cPasswordValid = document.getElementById("cpassword").style.border === '2px solid green'


  if(nameValid && emailValid && passwordValid && cPasswordValid){
    registerBtn.disabled = false;
  }else{
    registerBtn.disabled = true;
  }
}

function nameCheck() {
  let name = document.getElementById("name");
  let textbox_01 = document.getElementById("FirstNameForm");

  if (name.value.trim() === "") {
    textbox_01.textContent = "X Blank Values are not allowed";
    textbox_01.className = 'invalid-feedback';
    name.style.border = "2px solid red";
  } else if (name.value.length < 3) {
    textbox_01.textContent = 'X Length of the name should be 3 characters or more';
    textbox_01.className = 'invalid-feedback';
    name.style.border = "2px solid red";
  } else {
    textbox_01.textContent = '✔';
    textbox_01.className = 'valid-feedback';
    name.style.border = '2px solid green';
  }
  checkFormValidity();
}

function emailCheck() {
  let email = document.getElementById("email");
  let textbox_02 = document.getElementById("emailForms");

  if (email.value.trim() === "") {
    textbox_02.textContent = "X Blank Values are not allowed";
    textbox_02.className = 'invalid-feedback';
    email.style.border = "2px solid red";
  } else if (!emailChars.test(email.value)) {
    textbox_02.textContent = 'X Please Enter Valid Email Id';
    textbox_02.className = 'invalid-feedback';
    email.style.border = '2px solid red';
  } else {
    textbox_02.textContent = '✔';
    textbox_02.className = "valid-feedback";
    email.style.border = '2px solid green';
  }
  checkFormValidity();
}

function passwordCheck() {
  let password = document.getElementById("password");
  let textbox = document.getElementById("passwordForm");

  if (password.value.trim() === '') {
    textbox.textContent = 'X Blank Values are not allowed';
    textbox.className = 'invalid-feedback';
    password.style.border = '2px solid red';
    return false;
  } else if (password.value.length < 8) {
    textbox.textContent = 'X Password should be more than 8 characters';
    textbox.className = 'invalid-feedback';
    password.style.border = '2px solid red';
  } else if (!lowerCaseLetters.test(password.value) || !upperCaseLetters.test(password.value)) {
    textbox.textContent = 'X Password should have both lowercase and uppercase characters';
    textbox.className = 'invalid-feedback';
    password.style.border = '2px solid red';
    return false;
  } else if (!specialCharacters.test(password.value)) {
    textbox.textContent = 'X Password should include at least one special character';
    textbox.className = 'invalid-feedback';
    password.style.border = '2px solid red';
  } else {
    textbox.textContent = '✔';
    textbox.className = 'valid-feedback';
    password.style.border = '2px solid green';
  }
  checkFormValidity();
}

function finalPassword() {
  let cpassword = document.getElementById("cpassword");
  let textbox = document.getElementById("cpasswordform");

  if (cpassword.value.trim() === '') {
    textbox.textContent = 'X Blank Values are not allowed';
    textbox.className = 'invalid-feedback';
    cpassword.style.border = '2px solid red';
  } else if (cpassword.value !== password.value) {
    textbox.textContent = 'Password Does not Match';
    textbox.className = 'invalid-feedback';
    cpassword.style.border = '2px solid red';
  } else {
    textbox.textContent = '✔';
    textbox.className = 'valid-feedback';
    cpassword.style.border = '2px solid green';
  }
  checkFormValidity();
}

document.getElementById("name").addEventListener("input", nameCheck);
document.getElementById("password").addEventListener("input", passwordCheck);
document.getElementById("email").addEventListener("input", emailCheck);
document.getElementById("cpassword").addEventListener("input", finalPassword);
