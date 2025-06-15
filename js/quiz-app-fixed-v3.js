document.addEventListener('DOMContentLoaded', () => {
    // --- Global Variables ---
    let quizQuestions = [];
    let userAnswers = [];
    let currentQ = 0;
    let correctCount = 0;
    let selectedTopics = [];
    let examTimeRemaining = 0;
    let examTimerInterval = null;
    let courseConfig = null;
    let isRealExamMode = false;

    // --- DOM Elements ---
    const startScreen = document.getElementById('startScreen');
    const quizScreen = document.getElementById('quizScreen');
    const resultsScreen = document.getElementById('resultsScreen');
    const loadingScreen = document.getElementById('loadingScreen');
    const topicList = document.getElementById('topicList');
    const qText = document.getElementById('qText');
    const optionsList = document.getElementById('optionsList');
    const explanationContainer = document.getElementById('explanation');
    const explText = document.getElementById('explText');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const submitBtn = document.getElementById('submitBtn');
    const menuBtn = document.getElementById('menuBtn');
    const restartBtn = document.getElementById('restartBtn');
    const backToMenuBtn = document.getElementById('backToMenuBtn');
    const reviewBtn = document.getElementById('reviewBtn');
    const currentQEl = document.getElementById('currentQ');
    const totalQEl = document.getElementById('totalQ');
    const correctCountEl = document.getElementById('correctCount');
    const accuracyEl = document.getElementById('accuracy');
    const progressFill = document.querySelector('.progress-fill');
    const timerDisplay = document.getElementById('timer-display');
    const realExamBtn = document.getElementById('realExamBtn');
    const startQuizBtn = document.getElementById('startBtn');
    const selectAllBtn = document.getElementById('selectAllBtn');

    // --- Helper Functions ---
    const showScreen = (screenId) => {
        [startScreen, quizScreen, resultsScreen, loadingScreen].forEach(screen => {
            if (screen) screen.classList.remove('active');
        });
        const screenToShow = document.getElementById(screenId);
        if (screenToShow) screenToShow.classList.add('active');
    };

    const goToMenu = () => {
        stopExamTimer();
        showScreen('startScreen');
        selectedTopics = [];
        // Uncheck all checkboxes
        document.querySelectorAll('#topicList input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
            cb.closest('.topic-item')?.classList.remove('selected');
        });
        updateStartButtons();
    };

    const updateQuizProgress = () => {
        if (!quizQuestions.length) return;
        const total = quizQuestions.length;
        const current = currentQ + 1;
        const answeredCount = userAnswers.filter(a => a !== null).length;
        
        if (progressFill) progressFill.style.width = `${(current / total) * 100}%`;
        if (currentQEl) currentQEl.textContent = current;
        if (totalQEl) totalQEl.textContent = total;
        if (correctCountEl) correctCountEl.textContent = correctCount;
        if (accuracyEl) {
            const accuracy = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
            accuracyEl.textContent = `${accuracy}%`;
        }
    };

    const shuffle = (array) => {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const arraysEqual = (a, b) => {
        if (!a || !b || a.length !== b.length) return false;
        const sortedA = [...a].sort((x, y) => x - y);
        const sortedB = [...b].sort((x, y) => x - y);
        return sortedA.every((val, index) => val === sortedB[index]);
    };
    
    const toggleExplanation = (show) => {
        if (explanationContainer) {
            explanationContainer.style.display = show ? 'block' : 'none';
        }
        if (show && quizQuestions[currentQ]) {
            explText.innerHTML = quizQuestions[currentQ].explanation;
        }
    };

    const updateButtonStates = () => {
        const isAnswered = userAnswers[currentQ] !== null;
        if (submitBtn) submitBtn.style.display = isAnswered ? 'none' : 'inline-block';
        if (nextBtn) nextBtn.style.display = isAnswered ? 'inline-block' : 'none';
        if (prevBtn) prevBtn.style.display = isAnswered ? 'inline-block' : 'none';
        
        if (prevBtn) prevBtn.disabled = currentQ === 0;
        if (nextBtn) {
            if (currentQ >= quizQuestions.length - 1) {
                nextBtn.textContent = 'Show Results';
            } else {
                nextBtn.textContent = 'Next';
            }
        }
    };

    // --- Core Quiz Logic ---

    const loadCourseConfig = async () => {
        try {
            const cacheBuster = `?v=${Date.now()}`;
            const module = await import(`./course-1101-fixed.js${cacheBuster}`);
            courseConfig = module.default;
            if (!courseConfig) {
                throw new Error('Course configuration not found in module');
            }
            const { updateTopicCounts } = module;
            if (typeof updateTopicCounts === 'function') {
                await updateTopicCounts();
            }
            renderTopics();
            return true;
        } catch (error) {
            console.error('Failed to load course configuration:', error);
            const errorContainer = document.createElement('div');
            errorContainer.className = 'error-container';
            errorContainer.innerHTML = `
                <h1>Error Loading Application</h1>
                <p>Failed to load course configuration. Please check the console for details.</p>
                <p><strong>Error:</strong> ${error.message}</p>
            `;
            document.body.innerHTML = '';
            document.body.prepend(errorContainer);
            return false;
        }
    };

    const loadQuestions = async (isExam) => {
        console.log('[loadQuestions] Called. isExam:', isExam, 'Initial selectedTopics (if not exam):', JSON.parse(JSON.stringify(selectedTopics)));
        showScreen('loadingScreen');
        quizQuestions = [];
        let questionLimits = {};
        const topicsToLoad = isExam ? Object.keys(courseConfig.topics) : selectedTopics;
        console.log('[loadQuestions] Effective topicsToLoad:', JSON.parse(JSON.stringify(topicsToLoad)));

        if (isExam) {
            console.log('[loadQuestions] Exam mode: Calculating weighted question limits.');
            const totalExamQuestions = courseConfig.examQuestionCount || 80;
            let totalWeight = 0;
            topicsToLoad.forEach(topic => {
                totalWeight += courseConfig.topics[topic]?.weight || 0;
            });
            console.log('[loadQuestions] Total weight for exam topics:', totalWeight);

            if (totalWeight > 0) {
                let assignedQuestions = 0;
                topicsToLoad.forEach(topic => {
                    const weight = courseConfig.topics[topic]?.weight || 0;
                    const num = Math.round((weight / totalWeight) * totalExamQuestions);
                    questionLimits[topic] = num;
                    assignedQuestions += num;
                });
                console.log('[loadQuestions] Initial question limits:', JSON.parse(JSON.stringify(questionLimits)), 'Assigned:', assignedQuestions, 'Target:', totalExamQuestions);
                
                let diff = totalExamQuestions - assignedQuestions;
                let topicIndex = 0;
                let iterations = 0; // Safety break for while loop
                while (diff !== 0 && iterations < topicsToLoad.length * 5) { // Increased safety break iterations
                    const topic = topicsToLoad[topicIndex % topicsToLoad.length];
                    if (diff > 0) {
                        questionLimits[topic]++;
                        diff--;
                    } else { // diff < 0
                        if(questionLimits[topic] > 0) {
                           questionLimits[topic]--;
                           diff++;
                        }
                    }
                    topicIndex++;
                    iterations++;
                }
                if (iterations >= topicsToLoad.length * 5 && diff !==0) {
                    console.warn('[loadQuestions] Could not perfectly distribute questions after iterations, diff remaining:', diff, 'Final limits:', JSON.parse(JSON.stringify(questionLimits)));
                }
                console.log('[loadQuestions] Final question limits for exam:', JSON.parse(JSON.stringify(questionLimits)));
            }
        }

        console.log('[loadQuestions] Starting to fetch questions for topics:', JSON.parse(JSON.stringify(topicsToLoad)));
        for (const topic of topicsToLoad) {
            const topicConfig = courseConfig.topics[topic];
            if (!topicConfig || !topicConfig.file) {
                console.warn(`[loadQuestions] Missing config or file for topic: ${topic}. Skipping.`);
                continue;
            }

            try {
                console.log(`[loadQuestions] Fetching questions for topic: ${topic} from ${topicConfig.file}`);
                const response = await fetch(`${topicConfig.file}?v=${Date.now()}`);
                if (!response.ok) {
                    console.error(`[loadQuestions] HTTP error for ${topic}! status: ${response.status}, ${response.statusText}`);
                    throw new Error(`HTTP error! status: ${response.status} for ${topicConfig.file}`);
                }
                let topicQuestions = await response.json();
                console.log(`[loadQuestions] Fetched ${topicQuestions.length} questions for ${topic}`);
                
                topicQuestions = topicQuestions.map(q => ({ ...q, topic }));

                const limit = questionLimits[topic];
                // Only apply limit if in exam mode AND a limit is set for the topic
                if (isExam && limit !== undefined && topicQuestions.length > limit) { 
                    console.log(`[loadQuestions] Limiting ${topic} from ${topicQuestions.length} to ${limit} questions for exam mode.`);
                    topicQuestions = shuffle([...topicQuestions]).slice(0, limit);
                }
                quizQuestions.push(...topicQuestions);
                console.log(`[loadQuestions] Current total quizQuestions: ${quizQuestions.length} after adding from ${topic}`);
            } catch (error) {
                console.error(`[loadQuestions] Error processing topic ${topic}:`, error.message, error.stack ? error.stack : '');
            }
        }
        console.log(`[loadQuestions] Finished fetching. Total quizQuestions loaded: ${quizQuestions.length}`);

        if (quizQuestions.length === 0) {
            console.warn('[loadQuestions] No questions loaded. Selected topics might be empty, files failed to load, or all selected topics had errors.');
            alert('Failed to load questions for the selected topics. Please check the browser console (F12) for more details.');
            showScreen('startScreen');
            return false;
        }

        quizQuestions = shuffle(quizQuestions);
        userAnswers = new Array(quizQuestions.length).fill(null);
        console.log(`[loadQuestions] Successfully loaded and shuffled ${quizQuestions.length} questions.`);
        return true;
    };

    const startQuiz = async (isExam) => {
        console.log('[startQuiz] Called. isExam:', isExam, 'Selected Topics:', JSON.parse(JSON.stringify(selectedTopics)));
        if (!isExam && selectedTopics.length === 0) {
            alert('Please select at least one topic to begin.');
            console.log('[startQuiz] No topics selected for non-exam mode. Aborting.');
            return;
        }
        isRealExamMode = isExam;
        console.log('[startQuiz] Loading questions...');
        const success = await loadQuestions(isExam);
        console.log('[startQuiz] loadQuestions success:', success);
        if (!success) {
            console.log('[startQuiz] loadQuestions failed. Aborting quiz start.');
            return;
        }

        currentQ = 0;
        correctCount = 0;
        
        if (isExam) {
            console.log('[startQuiz] Starting exam timer.');
            startExamTimer();
        } else {
            console.log('[startQuiz] Stopping exam timer (if any).');
            stopExamTimer();
            if (timerDisplay) timerDisplay.textContent = '';
        }

        console.log('[startQuiz] Showing quiz screen and loading first question.');
        showScreen('quizScreen');
        loadQ();
    };

    const loadQ = () => {
        if (currentQ < 0 || currentQ >= quizQuestions.length) return;

        const q = quizQuestions[currentQ];
        if (!qText || !optionsList) {
            console.error("Quiz elements not found!");
            return;
        }
        qText.innerHTML = q.question;
        optionsList.innerHTML = '';

        q.options.forEach((option, index) => {
            const li = document.createElement('li');
            const inputType = q.correct.length > 1 ? 'checkbox' : 'radio';
            li.innerHTML = `<input type="${inputType}" name="option" value="${index}" id="opt${index}"> <label for="opt${index}">${option}</label>`;
            optionsList.appendChild(li);
        });
        
        const isAnswered = userAnswers[currentQ] !== null;
        if (isAnswered) {
            showFeedback();
        } else {
            toggleExplanation(false);
        }
        updateButtonStates();
        updateQuizProgress();
    };

    const showFeedback = () => {
        const q = quizQuestions[currentQ];
        const userAnswer = userAnswers[currentQ];
        const options = optionsList.querySelectorAll('li');

        options.forEach((li, index) => {
            const input = li.querySelector('input');
            input.disabled = true;
            const isCorrect = q.correct.includes(index);
            
            // userAnswer might be null if we are reviewing unanswered questions
            const isSelected = userAnswer ? userAnswer.includes(index) : false;

            if (isCorrect) {
                li.classList.add('correct');
            } else if (isSelected) {
                li.classList.add('incorrect');
            }
            if (isSelected) {
                input.checked = true;
            }
        });

        toggleExplanation(true);
    };

    const submitA = () => {
        const selectedOptions = Array.from(optionsList.querySelectorAll('input:checked')).map(el => parseInt(el.value));
        if (selectedOptions.length === 0) {
            alert('Please select an answer.');
            return;
        }

        const wasAnswered = userAnswers[currentQ] !== null;
        userAnswers[currentQ] = selectedOptions;
        const q = quizQuestions[currentQ];
        const isCorrect = arraysEqual(selectedOptions, q.correct);

        if (!wasAnswered) {
            if (isCorrect) {
                correctCount++;
            }
        }
        
        showFeedback();
        updateButtonStates();
        updateQuizProgress();
    };

    const nextQ = () => {
        if (currentQ < quizQuestions.length - 1) {
            currentQ++;
            loadQ();
        } else {
            showResults();
        }
    };

    const prevQ = () => {
        if (currentQ > 0) {
            currentQ--;
            loadQ();
        }
    };

    const showResults = () => {
        stopExamTimer();
        const answeredCount = userAnswers.filter(a => a !== null).length;
        const accuracy = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;

        document.getElementById('finalScore').textContent = `${accuracy}%`;
        document.getElementById('totalQuestions').textContent = quizQuestions.length;
        document.getElementById('correctAnswers').textContent = correctCount;
        document.getElementById('incorrectAnswers').textContent = answeredCount - correctCount;
        document.getElementById('accuracyResult').textContent = `${accuracy}%`;
        
        const timeTakenEl = document.getElementById('timeTaken');
        if (isRealExamMode) {
            const totalDuration = courseConfig.examDuration || 5400;
            const timeElapsed = totalDuration - examTimeRemaining;
            timeTakenEl.textContent = formatTime(timeElapsed);
            timeTakenEl.parentElement.style.display = 'block';
        } else {
            timeTakenEl.parentElement.style.display = 'none';
        }

        showScreen('resultsScreen');
    };

    const reviewAnswers = () => {
        showScreen('quizScreen');
        currentQ = 0;
        loadQ();
    };

    // --- Timer Logic ---
    const startExamTimer = () => {
        stopExamTimer();
        examTimeRemaining = courseConfig.examDuration || 5400; // 90 minutes
        if (timerDisplay) {
            timerDisplay.textContent = formatTime(examTimeRemaining);
        }
        examTimerInterval = setInterval(() => {
            examTimeRemaining--;
            if (timerDisplay) {
                timerDisplay.textContent = formatTime(examTimeRemaining);
            }
            if (examTimeRemaining <= 0) {
                stopExamTimer();
                alert('Time is up!');
                showResults();
            }
        }, 1000);
    };

    const stopExamTimer = () => {
        clearInterval(examTimerInterval);
        examTimerInterval = null;
    };

    // --- UI Setup and Event Listeners ---

    const updateStartButtons = () => {
        const hasSelection = selectedTopics.length > 0;
        if (startQuizBtn) startQuizBtn.disabled = !hasSelection;
        if (realExamBtn) realExamBtn.disabled = false; // Always enabled
    };

    const toggleTopic = (topic, isChecked) => {
        const index = selectedTopics.indexOf(topic);
        if (isChecked && index === -1) {
            selectedTopics.push(topic);
        } else if (!isChecked && index !== -1) {
            selectedTopics.splice(index, 1);
        }
        updateStartButtons();
    };

    const selectAllTopics = () => {
        const checkboxes = document.querySelectorAll('#topicList input[type="checkbox"]');
        const allCurrentlySelected = selectedTopics.length === Object.keys(courseConfig.topics).length;

        checkboxes.forEach(cb => {
            const topicItem = cb.closest('.topic-item');
            if (allCurrentlySelected) {
                cb.checked = false;
                topicItem?.classList.remove('selected');
            } else {
                cb.checked = true;
                topicItem?.classList.add('selected');
            }
            toggleTopic(cb.value, cb.checked);
        });
    };

    const renderTopics = () => {
        if (!topicList || !courseConfig?.topics) return;
        topicList.innerHTML = '';
        for (const [topic, config] of Object.entries(courseConfig.topics)) {
            const count = config.count || 0;
            const topicId = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const div = document.createElement('div');
            div.className = 'topic-item';
            div.innerHTML = `
                <div class="topic-header">
                    <input type="checkbox" id="${topicId}" value="${topic}">
                    <label for="${topicId}">${topic} (${count} ${count === 1 ? 'question' : 'questions'})</label>
                </div>
                ${config.description ? `<p class="topic-description">${config.description}</p>` : ''}
            `;
            const checkbox = div.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', () => {
                div.classList.toggle('selected', checkbox.checked);
                toggleTopic(topic, checkbox.checked);
            });
            div.addEventListener('click', (e) => {
                if (e.target.tagName !== 'INPUT') {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                }
            });
            topicList.appendChild(div);
        }
    };

    const addEventListeners = () => {
        if (startQuizBtn) { // Now correctly references the button with id='startBtn'
        startQuizBtn.addEventListener('click', () => {
            console.log('[EVENT LISTENER] startBtn (Iniciar Quiz) clicked!');
            startQuiz(false);
        });
    }
        if (realExamBtn) realExamBtn.addEventListener('click', () => startQuiz(true));
        if (selectAllBtn) selectAllBtn.addEventListener('click', selectAllTopics);
        if (submitBtn) submitBtn.addEventListener('click', submitA);
        if (nextBtn) nextBtn.addEventListener('click', nextQ);
        if (prevBtn) prevBtn.addEventListener('click', prevQ);
        if (menuBtn) menuBtn.addEventListener('click', goToMenu);
        if (restartBtn) restartBtn.addEventListener('click', () => startQuiz(isRealExamMode));
        if (backToMenuBtn) backToMenuBtn.addEventListener('click', goToMenu);
        if (reviewBtn) reviewBtn.addEventListener('click', reviewAnswers);
    };

    const init = async () => {
        showScreen('loadingScreen');
        const configLoaded = await loadCourseConfig();
        if (configLoaded) {
            addEventListeners();
            updateStartButtons();
            showScreen('startScreen');
        }
    };

    init();
});
