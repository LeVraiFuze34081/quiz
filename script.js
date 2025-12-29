'use strict';

let QUESTIONS = [];

  const soloDescriptions = [
    "Ici, personne ne te juge",
    "Version sans témoins",
    "Juste toi et ton cerveau",
    "L’échec, mais en privé",
    "Le mode sans stress"
  ];

  const multiDescriptions = [
    "Prêt à prouver que tu es le meilleur ?",
    "Prêt à mordre la poussière ?",
    "Que le meilleur gagne !",
    "Seul on est nul, ensemble aussi",
    "99 % de mauvaises réponses garanties"
  ];

  function getRandomItem(array) {
    const randomIndex = Math.floor(Math.random() * array.length);
    return array[randomIndex];
  }

  document.addEventListener("DOMContentLoaded", () => {
    const soloDescElement = document.getElementById("solo-desc");
    const multiDescElement = document.getElementById("multi-desc");

    soloDescElement.textContent = getRandomItem(soloDescriptions);
    multiDescElement.textContent = getRandomItem(multiDescriptions);
  });

const menuContainer = document.getElementById('menu-container');
const soloContainer = document.getElementById('solo-container');
const multiContainer = document.getElementById('multi-container');
const joinContainer = document.getElementById('join-container');
const lobbyContainer = document.getElementById('lobby-container');
const gameContainer = document.getElementById('game-container');
const finalContainer = document.getElementById('final-container');

const soloBtn = document.getElementById('solo-btn');
const multiBtn = document.getElementById('multi-btn');
const startSoloBtn = document.getElementById('start-solo-btn');
const quitSoloBtn = document.getElementById('quit-solo-btn');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const quitMultiBtn = document.getElementById('quit-multi-btn');
const joinRoomConfirmBtn = document.getElementById('join-room-confirm-btn');
const quitJoinBtn = document.getElementById('quit-join-btn');
const startMultiBtn = document.getElementById('start-multi-btn');
const quitLobbyBtn = document.getElementById('quit-lobby-btn');

const soloQuestionCount = document.getElementById('solo-question-count');
const multiQuestionCount = document.getElementById('multi-question-count');
const multiPseudoInput = document.getElementById('multi-pseudo');
const joinRoomCodeInput = document.getElementById('join-room-code');
const roomIdDisplay = document.getElementById('room-id-display');
const playersListDiv = document.getElementById('player-list');
const playersListGameDiv = document.getElementById('players-list');
const playerScoreDiv = document.getElementById('player-score');
const questionNumberDiv = document.getElementById('question-number');
const questionTextDiv = document.getElementById('question-text');
const correctionDiv = document.getElementById('correction');
const heartsDiv = document.getElementById('hearts');
const timerDiv = document.getElementById('timer');

const answerInput = document.getElementById('answer-input');
const optionsContainer = document.getElementById('options-container');

let socket = null;
let playerName = '';
let roomId = '';
let isHost = false;
let multiStarted = false;
let currentQuestionIndex = null;
let selected = [], idx = 0, score = 0, timer = null, timeLeft = 20, tries = 4, log = [], showingCorrection = false;
let currentSelectedOption = "";
let isSubmitting = false;

function resetGameState() {
  clearInterval(timer);
  timer = null;
  showingCorrection = false;
  timeLeft = 20;
  tries = 4;

  questionNumberDiv.textContent = '';
  questionTextDiv.textContent = '';
  correctionDiv.classList.remove('show');
  correctionDiv.textContent = '';
  heartsDiv.textContent = '';
  timerDiv.textContent = '';
  playerScoreDiv.textContent = 'Score : 0';
  playersListGameDiv.innerHTML = '';
  finalContainer.innerHTML = '';

  answerInput.disabled = false;
  answerInput.value = '';
  optionsContainer.innerHTML = '';
  optionsContainer.classList.add('hidden');
  answerInput.classList.remove('hidden');

  multiStarted = false;
  roomId = '';
  isHost = false;
}

function normalizeAnswer(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}
function calculatePoints(timeLeft) {
  if (timeLeft >= 18) return 10;
  if (timeLeft >= 16) return 9;
  if (timeLeft >= 14) return 8;
  if (timeLeft >= 12) return 7;
  if (timeLeft >= 10) return 6;
  return 5;
}
function showContainer(id) {
  [menuContainer, soloContainer, multiContainer, joinContainer, lobbyContainer, gameContainer, finalContainer].forEach(c => c.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

soloBtn.addEventListener('click', () => { showContainer('solo-container'); });
multiBtn.addEventListener('click', () => { showContainer('multi-container'); });
quitSoloBtn.addEventListener('click', () => { showContainer('menu-container'); });
quitMultiBtn.addEventListener('click', () => {
  if (socket) {
    socket.send(JSON.stringify({ action: 'leaveRoom' }));
    socket.close();
    socket = null;
  }
  resetGameState();
  showContainer('menu-container');
});
quitJoinBtn.addEventListener('click', () => { showContainer('multi-container'); });

createRoomBtn.addEventListener('click', () => {
  const pseudo = multiPseudoInput.value.trim();
  if (!pseudo) { alert("Entrez un pseudo"); return; }
  playerName = pseudo;
  connectSocket(() => {
    socket.send(JSON.stringify({ action: 'createRoom', pseudo: playerName }));
  });
});
joinRoomBtn.addEventListener('click', () => {
  const pseudo = multiPseudoInput.value.trim();
  if (!pseudo) { alert("Entrez un pseudo"); return; }
  playerName = pseudo;
  showContainer('join-container');
});
joinRoomConfirmBtn.addEventListener('click', () => {
  const code = joinRoomCodeInput.value.trim().toUpperCase();
  if (!code) { alert("Entrez le code de la room"); return; }
  roomId = code;
  connectSocket(() => {
    socket.send(JSON.stringify({ action: 'joinRoom', pseudo: playerName, room: roomId }));
  });
});
startMultiBtn.addEventListener('click', () => {
  const value = Number(multiQuestionCount.value);
  if (!Number.isInteger(value) || value < 1 || value > 30) {
    alert("Nombre de questions invalide");
    return;
  }
  socket.send(JSON.stringify({
    action: 'startGame',
    questionCount: value 
  }));
});
quitLobbyBtn.addEventListener('click', () => {
  if (socket) {
    socket.send(JSON.stringify({ action: 'leaveRoom' }));
    socket.close();
    socket = null;
  }
  resetGameState();
  showContainer('menu-container');
});

async function startSoloGame() {
  const value = Number(soloQuestionCount.value);
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    alert("Nombre de questions invalide");
    return;
  }
  try {
    startSoloBtn.textContent = "Chargement...";
    const response = await fetch('https://test-btvw.onrender.com/questions');
    if (!response.ok) throw new Error("Erreur serveur");
    QUESTIONS = await response.json();
    startSoloBtn.textContent = "Commencer";
    const count = Math.min(value, QUESTIONS.length);
    selected = [...QUESTIONS]
      .sort(() => Math.random() - 0.5)
      .slice(0, count); 
    score = 0;
    idx = 0;
    log = [];
    playerScoreDiv.textContent = 'Score : 0';
    showContainer('game-container');
    loadQuestionSolo();
  } catch (error) {
    console.error(error);
    alert("Impossible de récupérer les questions. Vérifiez que le serveur est allumé.");
    startSoloBtn.textContent = "Lancer une partie";
  }
}

function loadQuestionSolo() {
  clearInterval(timer);
  showingCorrection = false; timeLeft = 20; tries = 4;
  const q = selected[idx];
  questionNumberDiv.textContent = `Question ${idx+1} / ${selected.length}`;
  questionTextDiv.textContent = q.q;
  correctionDiv.classList.remove('show');
  
  answerInput.value = ''; 
  answerInput.disabled = false;
  optionsContainer.innerHTML = '';
  optionsContainer.classList.add('hidden');
  answerInput.classList.remove('hidden');
  heartsDiv.style.visibility = 'visible';

  if (q.type === 'qcm' || q.type === 'vf') {
    answerInput.classList.add('hidden');
    optionsContainer.classList.remove('hidden');
    heartsDiv.style.visibility = 'hidden';
    
    let opts = q.options;
    if(q.type === 'qcm') {
       opts = [...q.options].sort(() => Math.random() - 0.5);
    }

    opts.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.textContent = opt;
      btn.dataset.val = opt;
      btn.onclick = () => {
        currentSelectedOption = opt; 
        answerInput.value = opt; 
        const allBtns = optionsContainer.querySelectorAll('.option-btn');
        allBtns.forEach(b => b.disabled = true);
        submitAnswerSolo(); 
      };
      optionsContainer.appendChild(btn);
    });
  } else {
    answerInput.focus();
    updateHearts();
  }

  updateTimer();
  timer = setInterval(() => {
    timeLeft--; updateTimer();
    if (timeLeft <= 0) {
        submitAnswerSolo(true); 
    }
  }, 1000);
}

function updateTimer() {
  if (showingCorrection) {
    if (multiStarted) {
        timerDiv.textContent = `Correction dans : ${timeLeft}s`;
    } else {
        timerDiv.textContent = `Correction : ${timeLeft}s`;
    }
  } else {
    timerDiv.textContent = `Temps restant : ${timeLeft}s`;
  }
}
function updateHearts() {
  heartsDiv.textContent = tries > 0 ? '❤️'.repeat(tries) : '';
}

async function submitAnswerSolo(forceTimeout = false) {
  if (isSubmitting || (showingCorrection && !forceTimeout)) return;
  
  const val = normalizeAnswer(answerInput.value);
  const currentQ = selected[idx];

  if (!val && !forceTimeout) return;

  isSubmitting = true;
  answerInput.disabled = true;

  try {
    let isFinalAttempt = false;
    if (currentQ.type === 'qcm' || currentQ.type === 'vf') {
        isFinalAttempt = true;
    } else if (tries <= 1 || forceTimeout) {
        isFinalAttempt = true;
    }

    const res = await fetch('https://test-btvw.onrender.com/validate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ 
            id: currentQ.id, 
            answer: answerInput.value,
            isFinal: isFinalAttempt
        })
    });
    
    if (!res.ok) throw new Error('Erreur validation');
    
    const result = await res.json();
    const isCorrect = result.ok;
    const correctAnswers = result.correctAnswers;

    if (isCorrect) {
        const points = calculatePoints(timeLeft);
        score += points;
        log.push({ ...currentQ, a: correctAnswers, user: answerInput.value || 'Aucune', ok: true, points });
        playerScoreDiv.textContent = `Score : ${score}`;
        
        isSubmitting = false; 
        endQuestionSolo(correctAnswers, true);
    } else {
        if (currentQ.type === 'qcm' || currentQ.type === 'vf') {
            tries = 0;
        } else {
            tries--;
        }
        updateHearts();
        if (tries <= 0 || forceTimeout) {
            log.push({ ...currentQ, a: correctAnswers, user: answerInput.value || 'Aucune', ok: false, points: 0 });
            isSubmitting = false;
            endQuestionSolo(correctAnswers, false);
        } else {
            answerInput.value = '';
            answerInput.disabled = false;
            answerInput.focus();
            isSubmitting = false;
        }
    }
  } catch (e) {
      console.error(e);
      isSubmitting = false;
      answerInput.disabled = false;
  }
}

function endQuestionSolo(correctAnswers, isCorrect) {
  showingCorrection = true;
  clearInterval(timer);

  answerInput.disabled = true;

  const allBtns = optionsContainer.querySelectorAll('.option-btn');
  allBtns.forEach(b => {
    b.disabled = true;
  });

  correctionDiv.textContent = `Réponse : ${correctAnswers.join(' / ')}`;
  correctionDiv.classList.add('show');
  
  if (isCorrect) {
    correctionDiv.classList.remove('incorrect');
    correctionDiv.classList.add('correct');
  } else {
    correctionDiv.classList.remove('correct');
    correctionDiv.classList.add('incorrect');
  }

  let timeLeftCorr = 3;
  timerDiv.textContent = `Correction : ${timeLeftCorr}s`;
  
  const corrInt = setInterval(() => {
    timeLeftCorr--;
    if (timeLeftCorr > 0) {
      timerDiv.textContent = `Correction : ${timeLeftCorr}s`;
    } else {
      clearInterval(corrInt);
      timerDiv.textContent = '';
      
      idx++;
      if (idx < selected.length) {
        loadQuestionSolo();
      } else {
        endSoloGame();
      }
    }
  }, 1000);
}

function nextQuestionSolo() {
  clearInterval(timer);
  idx++;
  if (idx >= selected.length) endSoloGame();
  else loadQuestionSolo();
}

function endSoloGame() {
    const res = finalContainer;
    res.innerHTML = '';

    const correctCount = log.filter(r => r.ok).length;
    const totalQuestions = log.length;

    const summary = document.createElement('div');
    summary.style.color = 'white';
    summary.style.fontSize = '20px';
    summary.style.marginBottom = '20px';
    summary.textContent = `Score : ${score} points – Réponses justes : ${correctCount} / ${totalQuestions}`;
    res.appendChild(summary);

    const title = document.createElement('h2');
    title.textContent = 'CORRECTIONS';
    res.appendChild(title);

    log.forEach((r, i) => {
        const d = document.createElement('div');
        d.className = `end-correction-item ${r.ok ? 'correct-border' : 'incorrect-border'}`;

        const header = document.createElement('div');
        header.className = 'result-header';
        
        const spanQNum = document.createElement('span');
        spanQNum.textContent = `Question ${i+1}`;
        header.appendChild(spanQNum);

        const spanStatus = document.createElement('span');
        spanStatus.className = `status ${r.ok ? 'correct' : 'incorrect'}`;
        spanStatus.textContent = r.ok ? '✓ BONNE RÉPONSE' : '✗ MAUVAISE RÉPONSE';
        header.appendChild(spanStatus);
        
        d.appendChild(header);

        const body = document.createElement('div');
        body.className = 'result-body';

        const divQText = document.createElement('div');
        const strongQ = document.createElement('strong');
        strongQ.textContent = r.q;
        divQText.appendChild(strongQ);
        body.appendChild(divQText);

        const divUser = document.createElement('div');
        divUser.style.marginTop = '5px';
        const labelUser = document.createElement('span');
        labelUser.className = 'result-label';
        labelUser.textContent = 'Votre réponse : ';
        divUser.appendChild(labelUser);
        divUser.appendChild(document.createTextNode(r.user));
        body.appendChild(divUser);

        const divGood = document.createElement('div');
        const labelGood = document.createElement('span');
        labelGood.className = 'result-label';
        labelGood.textContent = 'Bonne(s) réponse(s) : ';
        divGood.appendChild(labelGood);
        const spanGood = document.createElement('span');
        spanGood.style.color = 'var(--success)';
        spanGood.textContent = (r.a && Array.isArray(r.a)) ? r.a.join(' / ') : '';
        divGood.appendChild(spanGood);
        body.appendChild(divGood);

        if (r.ok) {
            const divPts = document.createElement('div');
            divPts.style.color = 'var(--accent)';
            divPts.style.fontWeight = 'bold';
            divPts.textContent = `+ ${r.points} pts`;
            body.appendChild(divPts);
        }

        d.appendChild(body);
        res.appendChild(d);
    });

    const btn = document.createElement('button');
    btn.textContent = 'Nouvelle partie';
    btn.onclick = () => { showContainer('solo-container'); };
    res.appendChild(btn);

    const btnQuit = document.createElement('button');
    btnQuit.textContent = 'Quitter';
    btnQuit.style.background = 'linear-gradient(135deg,#ff6b6b,#cf4d4d)';
    btnQuit.onclick = () => {
        resetGameState();
        showContainer('menu-container');
    };
    res.appendChild(btnQuit);

    showContainer('final-container');
}

function connectSocket(onOpenCallback) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    onOpenCallback();
    return;
  }
  socket = new WebSocket('wss://test-btvw.onrender.com');
  socket.onopen = () => {
    onOpenCallback();
  };
  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    switch(msg.action) {
      case 'roomCreated':
        roomId = msg.roomId;
        isHost = true;
        roomIdDisplay.textContent = roomId;
        showContainer('lobby-container');
        break;
      case 'roomJoined':
        roomId = msg.roomId;
        isHost = false;
        roomIdDisplay.textContent = roomId;
        showContainer('lobby-container');
        break;
      case 'updateRoom':
        updateLobbyPlayers(msg.players);
        if (!isHost) {
          document.getElementById('host-controls').style.display = 'none';
        }
        break;
      case 'gameStarted':
        multiStarted = true;
        document.getElementById('waiting-host-msg').style.display = 'none';
        playersListGameDiv.innerHTML = '';
        playerScoreDiv.textContent = 'Score : 0';
        finalContainer.innerHTML = '';
        showContainer('game-container');
        break;
      case 'newQuestion':
        loadQuestionMulti(msg.question, msg.index, msg.total);
        break;
      case 'revealAnswer':
        showCorrectionMulti(msg.correctAnswers);
        break;
      case 'answerResult':
        handleAnswerResult(msg.correct, msg.points, msg.correctAnswers);
        break;
      case 'updateScores':
        updateScores(msg.players);
        break;
      case 'gameEnded':
        showGameEnd(msg.rankings, msg.log);
        break;
      case 'error':
        alert(msg.message);
        break;
    }
  };
socket.onclose = () => {
  resetGameState();
  if (!multiStarted) {
    showContainer('menu-container');
  }
};
}

function updateLobbyPlayers(players) {
  playersListDiv.innerHTML = ''; 

  players.forEach(p => {
    const div = document.createElement('div');
    div.textContent = p.name + (p.isHost ? ' (Hôte)' : '');
    playersListDiv.appendChild(div);
  });

  document.getElementById('host-controls').style.display = isHost ? 'block' : 'none';
  const waitingMsg = document.getElementById('waiting-host-msg');

  if (!isHost && !multiStarted) {
    waitingMsg.style.display = 'block';
  } else {
    waitingMsg.style.display = 'none';
  }
}

function loadQuestionMulti(question, index, total) {
  clearInterval(timer);
  timerDiv.textContent = '';
  showingCorrection = false;
  timeLeft = 20; tries = 4;
  currentQuestionIndex = index;
  questionNumberDiv.textContent = `Question ${index} / ${total}`;
  questionTextDiv.textContent = question.q;
  correctionDiv.classList.remove('show');
  currentSelectedOption = "";
  
  answerInput.value=''; 
  answerInput.disabled=false; 
  optionsContainer.innerHTML = '';
  optionsContainer.classList.add('hidden');
  answerInput.classList.remove('hidden');
  heartsDiv.style.visibility = 'visible';

  if (question.type === 'qcm' || question.type === 'vf') {
    answerInput.classList.add('hidden');
    optionsContainer.classList.remove('hidden');
    heartsDiv.style.visibility = 'hidden';

    let opts = question.options;
    if (question.type === 'qcm') {
       opts = [...question.options].sort(() => Math.random() - 0.5);
    }

    opts.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.textContent = opt;
      btn.dataset.val = opt;
      btn.onclick = () => {
        currentSelectedOption = opt;
        socket.send(JSON.stringify({
          action: 'submitAnswer',
          answer: opt
        }));
        const allBtns = optionsContainer.querySelectorAll('button');
        allBtns.forEach(b => b.disabled = true);
      };
      optionsContainer.appendChild(btn);
    });

  } else {
    answerInput.focus();
    updateHearts();
  }

  updateTimer();
  timer = setInterval(() => {
    timeLeft--; updateTimer();
    if (timeLeft <= 0) {
      answerInput.disabled = true;
      const allBtns = optionsContainer.querySelectorAll('button');
      allBtns.forEach(b => b.disabled = true);
      
      socket.send(JSON.stringify({ action: 'timeout', index }));
      clearInterval(timer);
    }
  }, 1000);
}

function showCorrectionMulti(correctAnswers) {
  showingCorrection = true;
  clearInterval(timer);
  
  const allBtns = optionsContainer.querySelectorAll('.option-btn');
  allBtns.forEach(b => b.disabled = true);
  answerInput.disabled = true;

  const userVal = normalizeAnswer(answerInput.value || currentSelectedOption);
  const isCorrect = correctAnswers.map(normalizeAnswer).includes(userVal);

  correctionDiv.textContent = `Réponse : ${correctAnswers.join(' / ')}`;
  correctionDiv.classList.add('show');
  
  if (userVal !== "" && isCorrect) {
    correctionDiv.className = 'show correct';
  } else {
    correctionDiv.className = 'show incorrect';
  }

  let timeLeftCorr = 5;
  timerDiv.textContent = `Correction : ${timeLeftCorr}s`;
  
  timer = setInterval(() => {
    timeLeftCorr--;
    if (timeLeftCorr > 0) {
      timerDiv.textContent = `Correction : ${timeLeftCorr}s`;
    } else {
      clearInterval(timer);
      timerDiv.textContent = '';
    }
  }, 1000);
}

function handleAnswerResult(isCorrect, points, correctAnswers) {
  correctionDiv.classList.remove('correct', 'incorrect');

  if (isCorrect) {
    const currentScore = parseInt(playerScoreDiv.textContent.split(': ')[1] || 0);
    playerScoreDiv.textContent = `Score : ${currentScore + points}`;

    answerInput.disabled = true;
    correctionDiv.textContent = 'Bonne réponse';
    correctionDiv.classList.add('correct', 'show');

    showingCorrection = true;
    return;
  }

  tries--;
  updateHearts();

  const isQcmOrVf = !optionsContainer.classList.contains('hidden');

  if (tries <= 0 || isQcmOrVf) {
    answerInput.disabled = true;
    const allBtns = optionsContainer.querySelectorAll('button');
    allBtns.forEach(b => b.disabled = true);

    correctionDiv.textContent = 'Mauvaise(s) réponse(s)';
    correctionDiv.classList.add('incorrect', 'show');
    showingCorrection = true;
  } else {
    answerInput.value = '';
    answerInput.disabled = false;
    answerInput.focus();
  }
}

function updateScores(players) {
  playersListGameDiv.innerHTML = '';
  players.forEach((p, idx) => {
    const div = document.createElement('div');
    div.className = 'player-item' + (p.name === playerName ? ' self' : '');
    const checkMark = p.isCorrect ? ' ✅' : '';
    div.textContent = `${idx+1}. ${p.name} - ${p.score} pts${checkMark}`;
    playersListGameDiv.appendChild(div);
  });
  const me = players.find(p => p.name === playerName);
  if (me) {
    playerScoreDiv.textContent = `Score : ${me.score}`;
  }
}

function showGameEnd(rankings, log) {
    const res = finalContainer;
    res.innerHTML = '';

    const rankTitle = document.createElement('h2');
    rankTitle.textContent = 'Classement final';
    res.appendChild(rankTitle);

    rankings.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'result-item';
        
        const spanName = document.createElement('span');
        spanName.textContent = `${i + 1}. ${p.name}`;
        div.appendChild(spanName);
        
        const spanScore = document.createElement('span');
        spanScore.textContent = `${p.score} pts`;
        div.appendChild(spanScore);
        
        res.appendChild(div);
    });

    const myScore = log.reduce((sum, r) => sum + (r.points || 0), 0);
    const goodCount = log.filter(r => r.ok).length;

    const mySummary = document.createElement('div');
    mySummary.style.color = 'white';
    mySummary.style.fontSize = '18px';
    mySummary.style.margin = '20px 0';
    mySummary.textContent = `Vos résultats : ${goodCount} bonnes réponses – Score : ${myScore} pts`;
    res.appendChild(mySummary);

    const title = document.createElement('h2');
    title.textContent = 'CORRECTIONS';
    res.appendChild(title);

    log.forEach((r, i) => {
        const d = document.createElement('div');
        d.className = `end-correction-item ${r.ok ? 'correct-border' : 'incorrect-border'}`;
        
        const header = document.createElement('div');
        header.className = 'result-header';
        
        const spanQ = document.createElement('span');
        spanQ.textContent = `Question ${i+1}`;
        header.appendChild(spanQ);

        const spanStatus = document.createElement('span');
        spanStatus.className = `status ${r.ok ? 'correct' : 'incorrect'}`;
        spanStatus.textContent = r.ok ? '✓ BONNE RÉPONSE' : '✗ MAUVAISE RÉPONSE';
        header.appendChild(spanStatus);
        
        d.appendChild(header);

        const body = document.createElement('div');
        body.className = 'result-body';

        const divQ = document.createElement('div');
        const strQ = document.createElement('strong');
        strQ.textContent = r.q;
        divQ.appendChild(strQ);
        body.appendChild(divQ);

        const divUser = document.createElement('div');
        divUser.style.marginTop = '5px';
        const lblUser = document.createElement('span');
        lblUser.className = 'result-label';
        lblUser.textContent = 'Votre réponse : ';
        divUser.appendChild(lblUser);
        divUser.appendChild(document.createTextNode(r.user));
        body.appendChild(divUser);

        const divGood = document.createElement('div');
        const lblGood = document.createElement('span');
        lblGood.className = 'result-label';
        lblGood.textContent = 'Bonne(s) réponse(s) : ';
        divGood.appendChild(lblGood);
        const spanGood = document.createElement('span');
        spanGood.style.color = 'var(--success)';
        spanGood.textContent = (r.a && Array.isArray(r.a)) ? r.a.join(' / ') : '';
        divGood.appendChild(spanGood);
        body.appendChild(divGood);

        if (r.ok) {
            const divPts = document.createElement('div');
            divPts.style.color = 'var(--accent)';
            divPts.style.fontWeight = 'bold';
            divPts.textContent = `+ ${r.points} pts`;
            body.appendChild(divPts);
        }

        d.appendChild(body);
        res.appendChild(d);
    });

    const btnContainer = document.createElement('div');
    btnContainer.style.display = 'flex';
    btnContainer.style.gap = '10px';
    btnContainer.style.marginTop = '20px';

    if (isHost) {
        const btnRetry = document.createElement('button');
        btnRetry.textContent = 'Nouvelle partie';
        btnRetry.onclick = () => {
            socket.send(JSON.stringify({ action: 'startOver' }));
        };
        btnContainer.appendChild(btnRetry);
    } else {
        const waitMsg = document.createElement('div');
        waitMsg.style.color = 'var(--muted)';
        waitMsg.style.padding = '14px';
        waitMsg.textContent = "En attente de l'hôte pour rejouer...";
        btnContainer.appendChild(waitMsg);
    }

    const btnQuit = document.createElement('button');
    btnQuit.textContent = 'Quitter la room';
    btnQuit.style.background = 'linear-gradient(135deg,#ff6b6b,#cf4d4d)';
    btnQuit.onclick = () => {
        if (socket) socket.close();
        resetGameState();
        showContainer('menu-container');
    };
    btnContainer.appendChild(btnQuit);

    res.appendChild(btnContainer);
    showContainer('final-container');
    
    multiStarted = false; 
}

document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (gameContainer.classList.contains('hidden')) return;

  if (!multiStarted) {
    submitAnswerSolo();
    return;
  }

  if (showingCorrection) return;

  const ans = answerInput.value.trim();
  if (!ans) return;

  socket.send(JSON.stringify({
    action: 'submitAnswer',
    answer: ans
  }));
});

startSoloBtn.addEventListener('click', startSoloGame);