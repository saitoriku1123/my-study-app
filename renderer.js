window.addEventListener('DOMContentLoaded', () => {

    const pages = document.querySelectorAll('.page');
    const navLinks = document.querySelectorAll('.nav-link');

    function showPage(pageId) {
        pages.forEach(page => page.classList.remove('active'));
        const targetPage = document.getElementById(pageId);
        if (targetPage) targetPage.classList.add('active');

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.dataset.page === pageId) {
                link.classList.add('active');
            }
        });
        if (pageId === 'page-stats') {
            updateStats(allTasks);
        }
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const pageId = link.dataset.page;
            showPage(pageId);
        });
    });

    let allTasks = [];
    let allScopes = [];
    let appSettings = {};
    let currentTaskFilter = 'today';
    let subjectChart = null;
    let weeklyChart = null;
    let dailyChart = null;
    let currentTaskToAddTime = null;

    const apiKeyInput = document.getElementById('api-key-input');
    const notificationToggle = document.getElementById('notification-toggle');
    const exportDataBtn = document.getElementById('export-data-btn');
    const importDataBtn = document.getElementById('import-data-btn');
    const deleteDataBtn = document.getElementById('delete-data-btn');
    const totalTimeEl = document.getElementById('total-time');
    const subjectChartCanvas = document.getElementById('subject-chart')?.getContext('2d');
    const weeklyChartCanvas = document.getElementById('weekly-chart')?.getContext('2d');
    const dailyChartCanvas = document.getElementById('daily-chart')?.getContext('2d');
    const taskList = document.querySelector('.task-list');
    const addTaskBtn = document.getElementById('add-task-btn');
    const taskModal = document.getElementById('task-modal');
    const taskForm = document.getElementById('add-task-form');
    const taskScopeSelect = document.getElementById('task-scope-select');
    const scopeList = document.querySelector('.scope-list');
    const addScopeBtn = document.getElementById('add-scope-btn');
    const scopeModal = document.getElementById('scope-modal');
    const scopeForm = document.getElementById('add-scope-form');
    const filterGroup = document.querySelector('.filter-group');
    const chatMessages = document.querySelector('.chat-messages');
    const chatInputForm = document.querySelector('.chat-input-form');
    const analysisModal = document.getElementById('analysis-modal');
    const analysisTitle = document.getElementById('analysis-title');
    const analysisTaskList = document.getElementById('analysis-task-list');
    const addTimeModal = document.getElementById('add-time-modal');
    const addTimeForm = document.getElementById('add-time-form');

    function saveSettings() {
        localStorage.setItem('appSettings', JSON.stringify(appSettings));
    }

    function loadSettings() {
        appSettings = JSON.parse(localStorage.getItem('appSettings') || '{}');
        appSettings.notifications = appSettings.notifications ?? true;
        appSettings.apiKey = appSettings.apiKey || '';
        if (apiKeyInput) apiKeyInput.value = appSettings.apiKey;
        if (notificationToggle) notificationToggle.checked = appSettings.notifications;
    }

    function checkDueTasksAndNotify() {
        if (!appSettings.notifications) return;
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
        const dueTodayTasks = allTasks.filter(task => task.dueDate === todayStr && !task.isCompleted);
        if (dueTodayTasks.length > 0 && typeof window.electronAPI?.showNotification === 'function') {
            window.electronAPI.showNotification({
                title: '今日のタスクが残っています！',
                body: `本日が期日のタスクが ${dueTodayTasks.length} 件あります。`
            });
        }
    }

    function renderTasks() {
        if (!taskList) return;
        taskList.innerHTML = '';
        const tasksToRender = filterTasks(allTasks, currentTaskFilter);
        tasksToRender.forEach(createTaskElement);
        updateStats(allTasks);
        updateScopeProgress();
    }
    
    function filterTasks(tasks, filter) {
        if (filter === 'all') return tasks;
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        return tasks.filter(task => {
            if (task.isCompleted) return false;
            if (!task.dueDate) return true;
            const dueDate = new Date(task.dueDate);
            dueDate.setHours(23, 59, 59, 999);
            return dueDate <= today;
        });
    }

    function saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(allTasks));
        renderTasks();
    }

    function loadTasks() {
        allTasks = JSON.parse(localStorage.getItem('tasks') || '[]').sort((a, b) => (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31'));
        renderTasks();
    }

    function renderScopes() {
        if (!scopeList) return;
        scopeList.innerHTML = '';
        allScopes.forEach(createTestScopeElement);
        updateScopeProgress();
    }

    function saveTestScopes() {
        localStorage.setItem('testScopes', JSON.stringify(allScopes));
        renderScopes();
    }

    function loadTestScopes() {
        allScopes = JSON.parse(localStorage.getItem('testScopes') || '[]');
        renderScopes();
    }

    function createTaskElement(task) {
        const taskItem = document.createElement('li');
        taskItem.classList.add('task-item');
        taskItem.dataset.id = task.id;
        let dueDateHTML = '';
        if (task.dueDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dueDate = new Date(task.dueDate);
            if (dueDate < today && !task.isCompleted) {
                taskItem.classList.add('is-overdue');
            }
            dueDateHTML = `<span class="due-date">期日: ${task.dueDate}</span>`;
        }
        taskItem.innerHTML = `<div class="checkbox-col"><input type="checkbox" ${task.isCompleted ? 'checked' : ''}></div><div class="task-details"><div class="task-title">${task.title}</div><div class="linked-scope">${task.scopeId ? `関連テスト: ${task.scopeName}` : ''}</div><div class="task-meta"><span class="subject-tag">${task.subject}</span>${dueDateHTML}</div><div class="attachment-area">${task.attachmentPath ? `添付資料: <a href="#" class="attachment-link">${task.attachmentName}</a> <button class="summarize-btn">要約</button>` : ''}</div></div><div class="actions-col"><button class="add-time-btn">＋</button><span class="elapsed-time">${formatTime(task.elapsedSeconds)}</span><button class="play-btn">▶</button><button class="attach-btn">📎</button><button class="delete-btn">&times;</button></div>`;
        taskList.appendChild(taskItem);
    }

    function createTestScopeElement(scope) {
        const scopeItem = document.createElement('li');
        scopeItem.classList.add('scope-item');
        scopeItem.dataset.id = scope.id;
        scopeItem.innerHTML = `<div class="scope-details"><div class="scope-meta"><span class="subject-tag">${scope.subject}</span></div><div class="scope-title">${scope.testName}</div><p>${scope.details}</p><div class="progress-bar-container"><div class="progress-bar">0%</div></div></div><button class="delete-btn">&times;</button>`;
        scopeList.appendChild(scopeItem);
    }

    function updateStats(tasks) {
        if (!totalTimeEl) return;
        const totalSeconds = tasks.reduce((sum, task) => sum + (task.elapsedSeconds || 0), 0);
        totalTimeEl.textContent = formatTime(totalSeconds, true);
        renderSubjectChart(tasks);
        renderWeeklyChart(tasks);
        renderDailyChart(tasks);
    }

    function updateScopeProgress() {
        document.querySelectorAll('.scope-item').forEach(scopeItem => {
            const scopeId = scopeItem.dataset.id;
            const progressBar = scopeItem.querySelector('.progress-bar');
            if (!progressBar) return;
            const linkedTasks = allTasks.filter(task => task.scopeId === scopeId);
            if (linkedTasks.length === 0) {
                progressBar.style.width = '0%';
                progressBar.textContent = '0%';
                return;
            };
            const completedTasks = linkedTasks.filter(task => task.isCompleted).length;
            const progress = Math.round((completedTasks / linkedTasks.length) * 100);
            progressBar.style.width = `${progress}%`;
            progressBar.textContent = `${progress}%`;
        });
    }

    function formatTime(totalSeconds, showHours = false) {
        if (isNaN(totalSeconds)) totalSeconds = 0;
        const hours = Math.floor(totalSeconds / 3600);
        totalSeconds %= 3600;
        const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const seconds = (totalSeconds % 60).toString().padStart(2, '0');
        if (showHours || hours > 0) return `${hours.toString().padStart(2, '0')}:${minutes}:${seconds}`;
        return `${minutes}:${seconds}`;
    }

    function populateScopesDropdown() {
        if (!taskScopeSelect) return;
        taskScopeSelect.innerHTML = '<option value="">なし</option>';
        allScopes.forEach(scope => {
            const option = document.createElement('option');
            option.value = scope.id;
            option.textContent = `${scope.testName} (${scope.subject})`;
            taskScopeSelect.appendChild(option);
        });
    }
    
    function addChatMessage(message, sender, messageId = null) {
        if (!chatMessages) return;
        const messageDiv = document.createElement('div');
        if (messageId) messageDiv.id = messageId;
        messageDiv.classList.add('chat-message', sender);
        const bubble = document.createElement('div');
        bubble.classList.add('message-bubble');
        if (sender === 'ai-typing') {
            bubble.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
        } else {
            bubble.textContent = message;
        }
        messageDiv.appendChild(bubble);
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    const subjectColorMaster = {'数学': '#007aff', '英語': '#34c759', '物理': '#ff9500', '化学': '#ff3b30', '国語': '#af52de', '歴史': '#5856d6', 'その他': '#8e8e93'};
    const colorPalette = Object.values(subjectColorMaster);
    let colorIndex = 0;
    const assignedColors = {};
    function getSubjectColor(subject) {
        if (assignedColors[subject]) return assignedColors[subject];
        if (subjectColorMaster[subject]) {
            assignedColors[subject] = subjectColorMaster[subject];
            return assignedColors[subject];
        }
        const newColor = colorPalette[colorIndex % colorPalette.length];
        assignedColors[subject] = newColor;
        colorIndex++;
        return newColor;
    }

    function renderSubjectChart(tasks) {
        if (!subjectChartCanvas) return;
        const subjectStats = {};
        tasks.forEach(task => { if (task.subject) { subjectStats[task.subject] = (subjectStats[task.subject] || 0) + (task.elapsedSeconds || 0); } });
        const labels = Object.keys(subjectStats);
        const data = Object.values(subjectStats);
        if (subjectChart) subjectChart.destroy();
        subjectChart = new Chart(subjectChartCanvas, { type: 'doughnut', data: { labels: labels, datasets: [{ data: data, backgroundColor: labels.map(label => getSubjectColor(label)), borderColor: '#fff', borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.label}: ${formatTime(c.parsed)}` } } } } });
    }

    function renderWeeklyChart(tasks) {
        if (!weeklyChartCanvas) return;
        const allSubjects = [...new Set(tasks.map(t => t.subject).filter(Boolean))];
        const weeklyData = {};
        const labels = [];
        const today = new Date();
        for (let i = 3; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i * 7);
            const startOfWeek = new Date(d.setDate(d.getDate() - d.getDay()));
            const key = `${startOfWeek.getFullYear()}-${(startOfWeek.getMonth() + 1).toString().padStart(2, '0')}-${startOfWeek.getDate().toString().padStart(2, '0')}`;
            labels.push(key);
            weeklyData[key] = {};
        }
        tasks.forEach(task => {
            if (task.elapsedSeconds > 0 && task.subject) {
                const taskDate = new Date(parseInt(task.id.replace('task-', '')));
                const startOfWeek = new Date(taskDate.setDate(taskDate.getDate() - taskDate.getDay()));
                const key = `${startOfWeek.getFullYear()}-${(startOfWeek.getMonth() + 1).toString().padStart(2, '0')}-${startOfWeek.getDate().toString().padStart(2, '0')}`;
                if (weeklyData[key]) { weeklyData[key][task.subject] = (weeklyData[key][task.subject] || 0) + (task.elapsedSeconds / 60); }
            }
        });
        const datasets = allSubjects.map(subject => ({ label: subject, data: labels.map(label => weeklyData[label][subject] || 0), backgroundColor: getSubjectColor(subject) }));
        const formattedLabels = labels.map(l => l.substring(5).replace('-', '/'));
        if (weeklyChart) weeklyChart.destroy();
        weeklyChart = new Chart(weeklyChartCanvas, { type: 'bar', data: { labels: formattedLabels, datasets: datasets }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, title: { display: true, text: '勉強時間 (分)' } } } } });
    }

    function renderDailyChart(tasks) {
        if (!dailyChartCanvas) return;
        const allSubjects = [...new Set(tasks.map(t => t.subject).filter(Boolean))];
        const dailyData = {};
        const labels = [];
        const today = new Date();
        for (let i = 13; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
            labels.push(key);
            dailyData[key] = {};
        }
        tasks.forEach(task => {
            if (task.elapsedSeconds > 0 && task.subject) {
                const taskDate = new Date(parseInt(task.id.replace('task-', '')));
                const key = `${taskDate.getFullYear()}-${(taskDate.getMonth() + 1).toString().padStart(2, '0')}-${taskDate.getDate().toString().padStart(2, '0')}`;
                if (dailyData[key]) { dailyData[key][task.subject] = (dailyData[key][task.subject] || 0) + (task.elapsedSeconds / 60); }
            }
        });
        const datasets = allSubjects.map(subject => ({ label: subject, data: labels.map(label => dailyData[label][subject] || 0), backgroundColor: getSubjectColor(subject) }));
        const formattedLabels = labels.map(l => l.substring(5).replace('-', '/'));
        if (dailyChart) dailyChart.destroy();
        dailyChart = new Chart(dailyChartCanvas, { type: 'bar', data: { labels: formattedLabels, datasets: datasets }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, title: { display: true, text: '勉強時間 (分)' } } } } });
    }

    const allModals = document.querySelectorAll('.modal-overlay');
    allModals.forEach(modal => { modal.querySelector('.close-btn')?.addEventListener('click', () => modal.classList.remove('is-visible')); });
    if (addTaskBtn) addTaskBtn.addEventListener('click', () => { populateScopesDropdown(); taskModal.classList.add('is-visible'); });
    if (addScopeBtn) addScopeBtn.addEventListener('click', () => { scopeModal.classList.add('is-visible'); });
    if (filterGroup) filterGroup.addEventListener('click', (event) => { if (event.target.tagName === 'BUTTON') { currentTaskFilter = event.target.dataset.filter; document.querySelector('.filter-btn.active')?.classList.remove('active'); event.target.classList.add('active'); renderTasks(); } });
    if (taskForm) taskForm.addEventListener('submit', (event) => { event.preventDefault(); const selectedScopeOption = taskScopeSelect.options?.[taskScopeSelect.selectedIndex]; allTasks.unshift({ id: `task-${Date.now()}`, title: document.getElementById('task-title-input').value, subject: document.getElementById('task-subject-input').value, dueDate: document.getElementById('task-due-date-input').value, elapsedSeconds: 0, isCompleted: false, scopeId: selectedScopeOption?.value || '', scopeName: selectedScopeOption?.textContent || '', attachmentPath: '', attachmentName: '' }); saveTasks(); taskForm.reset(); taskModal.classList.remove('is-visible'); });
    if (scopeForm) scopeForm.addEventListener('submit', (event) => { event.preventDefault(); allScopes.unshift({ id: `scope-${Date.now()}`, testName: document.getElementById('scope-test-name-input').value, subject: document.getElementById('scope-subject-input').value, details: document.getElementById('scope-details-input').value }); saveTestScopes(); scopeForm.reset(); scopeModal.classList.remove('is-visible'); });
    if (addTimeForm) addTimeForm.addEventListener('submit', (event) => { event.preventDefault(); if (!currentTaskToAddTime) return; const taskIndex = allTasks.findIndex(t => t.id === currentTaskToAddTime); if (taskIndex === -1) return; const minutesToAddInput = document.getElementById('minutes-to-add-input'); const minutesToAdd = parseInt(minutesToAddInput.value, 10); if (!isNaN(minutesToAdd) && minutesToAdd > 0) { allTasks[taskIndex].elapsedSeconds += minutesToAdd * 60; saveTasks(); } else { alert('有効な数値を入力してください。'); } addTimeModal.classList.remove('is-visible'); currentTaskToAddTime = null; minutesToAddInput.value = '30'; });
    if (taskList) taskList.addEventListener('click', async (event) => { const target = event.target; const taskItem = target.closest('.task-item'); if (!taskItem) return; const taskId = taskItem.dataset.id; const taskIndex = allTasks.findIndex(t => t.id === taskId); if (taskIndex === -1) return; if (target.classList.contains('add-time-btn')) { currentTaskToAddTime = taskId; addTimeModal.classList.add('is-visible'); document.getElementById('minutes-to-add-input').focus(); } else if (target.classList.contains('delete-btn')) { if (confirm(`「${allTasks[taskIndex].title}」を本当に削除しますか？`)) { allTasks.splice(taskIndex, 1); saveTasks(); } } else if (target.classList.contains('play-btn')) { const playBtn = target; const isRunning = taskItem.dataset.timerId; if (isRunning) { clearInterval(parseInt(taskItem.dataset.timerId, 10)); const startTime = parseInt(taskItem.dataset.startTime, 10); if (!isNaN(startTime)) { const elapsedInSession = Math.floor((Date.now() - startTime) / 1000); allTasks[taskIndex].elapsedSeconds += elapsedInSession; } taskItem.removeAttribute('data-timer-id'); taskItem.removeAttribute('data-start-time'); playBtn.textContent = '▶'; saveTasks(); } else { playBtn.textContent = '❚❚'; taskItem.dataset.startTime = Date.now(); const baseElapsedTime = allTasks[taskIndex].elapsedSeconds; const timerId = setInterval(() => { const currentStartTime = parseInt(taskItem.dataset.startTime, 10); if (isNaN(currentStartTime)) { clearInterval(timerId); return; } const elapsedInSession = Math.floor((Date.now() - currentStartTime) / 1000); taskItem.querySelector('.elapsed-time').textContent = formatTime(baseElapsedTime + elapsedInSession); }, 1000); taskItem.dataset.timerId = timerId; } } else if (target.type === 'checkbox') { allTasks[taskIndex].isCompleted = target.checked; saveTasks(); } else if (target.classList.contains('attach-btn')) { const file = await window.electronAPI.openFile(); if (file) { allTasks[taskIndex].attachmentPath = file.path; allTasks[taskIndex].attachmentName = file.name; saveTasks(); } } else if (target.classList.contains('summarize-btn')) { const filePath = allTasks[taskIndex].attachmentPath; if (filePath) { target.textContent = '...'; target.disabled = true; const summary = await window.electronAPI.summarizeFile(appSettings.apiKey, filePath); alert(summary); target.textContent = '要約'; target.disabled = false; } } else if (target.classList.contains('attachment-link')) { event.preventDefault(); const filePath = allTasks[taskIndex].attachmentPath; if (filePath) { window.electronAPI.openPath(filePath); } } });
    if (scopeList) scopeList.addEventListener('click', (event) => { const target = event.target; const scopeItem = target.closest('.scope-item'); if(!scopeItem) return; const scopeId = scopeItem.dataset.id; const scopeIndex = allScopes.findIndex(s => s.id === scopeId); if (scopeIndex === -1) return; if (target.classList.contains('delete-btn')) { if (confirm(`「${allScopes[scopeIndex].testName}」の範囲を削除しますか？`)) { allScopes.splice(scopeIndex, 1); saveTestScopes(); } } else { const scope = allScopes[scopeIndex]; const linkedTasks = allTasks.filter(task => task.scopeId === scope.id); analysisTitle.textContent = `「${scope.testName}」の進捗詳細`; analysisTaskList.innerHTML = ''; if (linkedTasks.length > 0) { linkedTasks.forEach(task => { const li = document.createElement('li'); const statusIcon = task.isCompleted ? '<span class="status-icon completed">✔</span>' : '<span class="status-icon incomplete">✖</span>'; li.innerHTML = `<div>${task.title}</div> ${statusIcon}`; if(task.isCompleted) li.classList.add('completed'); analysisTaskList.appendChild(li); }); } else { analysisTaskList.innerHTML = '<li>関連付けられたタスクはありません。</li>'; } analysisModal.classList.add('is-visible'); } });
    if (apiKeyInput) { apiKeyInput.addEventListener('keyup', () => { appSettings.apiKey = apiKeyInput.value; saveSettings(); }); }
    if (notificationToggle) { notificationToggle.addEventListener('change', () => { appSettings.notifications = notificationToggle.checked; saveSettings(); }); }
    if (exportDataBtn) { exportDataBtn.addEventListener('click', async () => { const dataToExport = JSON.stringify({ tasks: allTasks, scopes: allScopes, settings: appSettings }, null, 2); const result = await window.electronAPI.exportData(dataToExport); if (result.success) { alert(`データをエクスポートしました:\n${result.path}`); } }); }
    if (importDataBtn) { importDataBtn.addEventListener('click', async () => { if (!confirm('データをインポートしますか？現在のデータは上書きされます。')) return; const result = await window.electronAPI.importData(); if (result.success) { try { const importedData = JSON.parse(result.data); allTasks = importedData.tasks || []; allScopes = importedData.scopes || []; appSettings = importedData.settings || {}; saveTasks(); saveTestScopes(); saveSettings(); loadSettings(); alert('データのインポートが完了しました。'); } catch (e) { alert('エラー: インポートされたファイルが破損しているか、形式が正しくありません。'); } } }); }
    if (deleteDataBtn) { deleteDataBtn.addEventListener('click', () => { if (confirm('本当にすべてのデータを削除しますか？この操作は元に戻せません。')) { localStorage.clear(); window.location.reload(); } }); }
    if (chatInputForm) { chatInputForm.addEventListener('submit', async (event) => { event.preventDefault(); const input = chatInputForm.querySelector('input'); const message = input.value.trim(); if (!message) return; addChatMessage(message, 'user'); input.value = ''; input.disabled = true; addChatMessage('', 'ai-typing', 'typing-indicator'); try { const aiResponse = await window.electronAPI.getAIChatResponse(appSettings.apiKey, message); document.getElementById('typing-indicator')?.remove(); addChatMessage(aiResponse, 'ai'); } catch (error) { console.error('AIチャットエラー:', error); document.getElementById('typing-indicator')?.remove(); addChatMessage('エラーが発生しました。', 'ai'); } finally { input.disabled = false; input.focus(); } }); }

    loadSettings();
    showPage('page-stats');
    loadTasks();
    loadTestScopes();
    checkDueTasksAndNotify();
    setInterval(checkDueTasksAndNotify, 3600000);
});