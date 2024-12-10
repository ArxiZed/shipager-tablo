const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

let queue = [];
let nextNumber = 1;

const loginCredentials = {
    username: "Shipager",
    password: "akusher31@",
};

function checkLogin(req, res, next) {
    const { username, password } = req.query;
    if (username === loginCredentials.username && password === loginCredentials.password) {
        next();
    } else {
        res.redirect("/login");
    }
}

app.use(express.json());
app.use(express.static("public"));

app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/pult", checkLogin, (req, res) => {
    res.sendFile(path.join(__dirname, "public", "pult.html"));
});

app.get("/queue", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "queue.html"));
});

app.post("/take_queue", (req, res) => {
    const { iin } = req.body;

    if (!iin || iin.length !== 12 || isNaN(iin)) {
        return res.status(400).json({ error: "Некорректный ИИН" });
    }

    const time = new Date().toLocaleTimeString();
    const newTicket = {
        ticketNumber: nextNumber++,
        status: "В ожидании",
        iin,
        time,
    };

    queue.push(newTicket);

    io.emit("update_queue", queue);

    res.json(newTicket);
});

app.post("/queue_status", (req, res) => {
    const { ticketNumber } = req.body;
    const patient = queue.find(item => item.ticketNumber === ticketNumber);

    if (patient) {
        const isCompleted = patient.status === "Обслужен";
        res.json({ status: isCompleted ? "Completed" : patient.status });
    } else {
        res.status(404).json({ error: "Пациент не найден" });
    }
});

app.post("/accept_queue", (req, res) => {
    const patientToAccept = queue.find(item => item.status === "В ожидании");
    if (patientToAccept) {
        patientToAccept.status = "Принят";

        io.emit("update_queue", queue);
        res.json(patientToAccept);
    } else {
        res.status(404).json({ error: "Нет пациентов для принятия" });
    }
});

app.post("/next_queue", (req, res) => {
    const acceptedQueueItemIndex = queue.findIndex(item => item.status === "Принят");

    if (acceptedQueueItemIndex !== -1) {
        const servedPatient = queue.splice(acceptedQueueItemIndex, 1)[0];
        servedPatient.status = "Обслужен";

        io.emit("update_queue", queue);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Нет принятого пациента для удаления" });
    }
});

app.post("/cancel_queue", (req, res) => {
    const { ticketNumber } = req.body;
    queue = queue.filter(item => item.ticketNumber !== ticketNumber);

    io.emit("update_queue", queue);

    res.json({ success: true });
});

app.post("/reset_queue", (req, res) => {
    queue = [];
    nextNumber = 1;
    io.emit("update_queue", queue);
    res.json({ success: true });
});

io.on("connection", (socket) => {
    console.log("Клиент подключился.");
    socket.emit("update_queue", queue);
});

server.listen(3000, () => {
    console.log("Сервер запущен на порту 3000");
});
