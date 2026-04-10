document.querySelector("form").addEventListener("submit", async function (e) {
    e.preventDefault();

    const login = document.getElementById("login").value.trim();
    const password = document.getElementById("password").value.trim();

    const box = document.querySelector(".box");

    let old = document.getElementById("msg");
    if (old) old.remove();

    const msg = document.createElement("div");
    msg.id = "msg";

    const response = await fetch("http://127.0.0.1:5000/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ login, password })
    });

    const result = await response.json();

    if (result.status === "ok") {
        // 👉 переход на главную страницу
        window.location.href = "/main.html";
    } else {
        // 👉 неверный логин или пароль
        msg.textContent = "Неверный логин или пароль";
        msg.style.color = "red";
        box.appendChild(msg);
    }
});