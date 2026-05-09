/**
 * Aurora Sort - Premium QuickSort Visualization
 * Pure Vanilla JS Implementation
 */

// --- STATE MANAGEMENT ---
const state = {
    array: [],
    history: [], // Stores all states for timeline playback
    currentStep: 0,
    isPlaying: false,
    isSorted: false,
    speed: 50, // ms delay, inverted from slider
    audioCtx: null,
    
    // Stats
    comparisons: 0,
    swaps: 0,
    maxDepth: 0,
    startTime: 0,
    elapsedTime: 0,
    timerInterval: null
};

const treeRenderState = {
    rootId: null,
    activeId: null,
    doneIds: new Set(),
    nodeElements: new Map(),
    linkElements: new Map(),
    resizeObserver: null
};

// --- DOM ELEMENTS ---
const DOM = {
    barsContainer: document.getElementById('bars-container'),
    treeContainer: document.getElementById('tree-container'),
    treeEmpty: document.getElementById('tree-empty'),
    treeNodes: document.getElementById('tree-nodes'),
    treeSvg: document.getElementById('tree-svg'),
    pseudocode: document.getElementById('pseudocode'),
    insightToast: document.getElementById('insight-toast'),
    insightText: document.getElementById('insight-text'),
    
    // Stats
    statComparisons: document.getElementById('stat-comparisons'),
    statSwaps: document.getElementById('stat-swaps'),
    statDepth: document.getElementById('stat-depth'),
    statPivot: document.getElementById('stat-pivot'),
    statTime: document.getElementById('stat-time'),
    progressText: document.getElementById('progress-text'),
    progressFill: document.getElementById('progress-fill'),
    
    // Controls
    btnStart: document.getElementById('btn-start'),
    btnPause: document.getElementById('btn-pause'),
    btnNext: document.getElementById('btn-next'),
    btnPrev: document.getElementById('btn-prev'),
    btnReset: document.getElementById('btn-reset'),
    btnGenerate: document.getElementById('btn-generate'),
    btnLoadCustom: document.getElementById('btn-load-custom'),
    customInput: document.getElementById('custom-array-input'),
    sizeSlider: document.getElementById('size-slider'),
    speedSlider: document.getElementById('speed-slider'),
    themeToggle: document.getElementById('theme-toggle'),
    navLinks: document.querySelectorAll('nav a[data-nav-target]')
};

// --- INITIALIZATION ---
function init() {
    setupEventListeners();
    setupTreeResizeObserver();
    state.speed = getPlaybackDelay(DOM.speedSlider.value);
    generateArray();
}

function setupEventListeners() {
    DOM.btnGenerate.addEventListener('click', generateArray);
    DOM.btnStart.addEventListener('click', startSorting);
    DOM.btnPause.addEventListener('click', pauseSorting);
    DOM.btnReset.addEventListener('click', resetSorting);
    DOM.btnNext.addEventListener('click', stepForward);
    DOM.btnPrev.addEventListener('click', stepBackward);
    
    DOM.sizeSlider.addEventListener('input', (e) => {
        if(!state.isPlaying) generateArray();
    });
    
    DOM.speedSlider.addEventListener('input', (e) => {
        // Slider 1-100. 100 is fastest (10ms), 1 is slowest (1000ms)
        state.speed = getPlaybackDelay(e.target.value);
    });

    DOM.navLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const target = document.getElementById(link.dataset.navTarget);
            if (!target) return;

            DOM.navLinks.forEach(navLink => navLink.classList.remove('active'));
            link.classList.add('active');
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    DOM.btnLoadCustom.addEventListener('click', () => {
        const val = DOM.customInput.value;
        const arr = val.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        if(arr.length > 0) {
            loadCustomArray(arr);
        } else {
            showInsight("Invalid array format. Use comma separated numbers.");
        }
    });

    DOM.themeToggle.addEventListener('click', () => {
        const current = document.body.getAttribute('data-theme');
        if(current === 'dark') {
            document.body.removeAttribute('data-theme');
            DOM.themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
        } else {
            document.body.setAttribute('data-theme', 'dark');
            DOM.themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
        }
    });
}

// --- ARRAY & VISUALIZATION GENERATION ---

function generateArray() {
    stopSorting();
    const size = parseInt(DOM.sizeSlider.value);
    state.array = [];
    for(let i=0; i<size; i++) {
        state.array.push(Math.floor(Math.random() * 90) + 10); // 10-100
    }
    resetState();
    renderBars();
    renderTree(null); // Clear tree
}

function loadCustomArray(arr) {
    stopSorting();
    state.array = arr.slice(0, 50); // limit size
    resetState();
    renderBars();
    renderTree(null);
}

function resetState() {
    state.history = [];
    state.currentStep = 0;
    state.isPlaying = false;
    state.isSorted = false;
    state.fullTree = null;
    state.comparisons = 0;
    state.swaps = 0;
    state.maxDepth = 0;
    state.elapsedTime = 0;
    clearInterval(state.timerInterval);
    updateStats();
    DOM.barsContainer.classList.remove('sort-complete');
    hideInsight();
    updateControls();
}

function renderBars() {
    DOM.barsContainer.innerHTML = '';
    const maxVal = Math.max(...state.array, 100);
    
    state.array.forEach((value, index) => {
        const bar = document.createElement('div');
        bar.className = 'array-bar';
        bar.style.height = `${(value / maxVal) * 90}%`;
        bar.style.width = `${100 / state.array.length}%`;
        bar.dataset.index = index;
        bar.textContent = value;
        DOM.barsContainer.appendChild(bar);
    });
}

// --- QUICKSORT ALGORITHM & HISTORY GENERATOR ---

async function startSorting() {
    if (state.isSorted) return;
    
    if (state.history.length === 0) {
        // Need to run algorithm and generate history
        showInsight("Starting QuickSort algorithm...");
        generateHistory();
    }
    
    state.isPlaying = true;
    state.startTime = Date.now() - state.elapsedTime;
    state.timerInterval = setInterval(() => {
        state.elapsedTime = Date.now() - state.startTime;
        DOM.statTime.textContent = (state.elapsedTime / 1000).toFixed(1) + 's';
    }, 100);
    
    updateControls();
    playbackLoop();
}

function pauseSorting() {
    state.isPlaying = false;
    clearInterval(state.timerInterval);
    updateControls();
    showInsight("Sorting paused.");
}

function stopSorting() {
    state.isPlaying = false;
    clearInterval(state.timerInterval);
    updateControls();
}

function resetSorting() {
    stopSorting();
    // Restore original array from history if available
    if(state.history.length > 0) {
        state.array = [...state.history[0].array];
    }
    resetState();
    renderBars();
    renderTree(null);
}

function generateHistory() {
    let arr = [...state.array];
    let history = [];
    let comps = 0;
    let swaps = 0;
    let maxDepth = 0;
    
    // Helper for tree building
    let nextNodeId = 1;
    function buildTree(low, high, level) {
        return { id: nextNodeId++, low, high, level, status: 'pending', children: [] };
    }

    let rootTree = buildTree(0, arr.length - 1, 0);
    function pushHistory(step) {
        history.push({
            ...step,
            visibleNodeIds: collectVisibleNodeIds(rootTree),
            doneNodeIds: collectDoneNodeIds(rootTree)
        });
    }

    // Initial state
    pushHistory({
        type: 'INIT', array: [...arr], comps, swaps, depth: 0, pivot: '-', line: 0,
        activeIndices: [], partitionRange: null, treeNode: null
    });

    function quickSort(low, high, level, parentTree) {
        maxDepth = Math.max(maxDepth, level);
        
        pushHistory({
            type: 'RECURSION', array: [...arr], comps, swaps, depth: maxDepth, pivot: '-', line: 1,
            activeIndices: [], partitionRange: [low, high], treeNode: parentTree,
            msg: `quickSort(arr, ${low}, ${high})`
        });

        pushHistory({
            type: 'LINE', array: [...arr], comps, swaps, depth: maxDepth, pivot: '-', line: 2,
            activeIndices: [], partitionRange: [low, high], treeNode: parentTree
        });

        if (low < high) {
            parentTree.status = 'active';
            pushHistory({
                type: 'LINE', array: [...arr], comps, swaps, depth: maxDepth, pivot: '-', line: 3,
                activeIndices: [], partitionRange: [low, high], treeNode: parentTree
            });

            let pi = partition(low, high, level, parentTree);
            
            let leftChild = buildTree(low, pi - 1, level + 1);
            let rightChild = buildTree(pi + 1, high, level + 1);
            parentTree.children.push(leftChild, rightChild);

            pushHistory({
                type: 'LINE', array: [...arr], comps, swaps, depth: maxDepth, pivot: arr[pi], line: 4,
                activeIndices: [], partitionRange: [low, high], treeNode: leftChild
            });
            quickSort(low, pi - 1, level + 1, leftChild);
            
            pushHistory({
                type: 'LINE', array: [...arr], comps, swaps, depth: maxDepth, pivot: arr[pi], line: 5,
                activeIndices: [], partitionRange: [low, high], treeNode: rightChild
            });
            quickSort(pi + 1, high, level + 1, rightChild);
            
            parentTree.status = 'done';
            pushHistory({
                type: 'RECURSION_DONE', array: [...arr], comps, swaps, depth: maxDepth, pivot: '-', line: 6,
                activeIndices: [], partitionRange: null, treeNode: parentTree,
                msg: `Finished subarray [${low}...${high}]`
            });
        } else if (low === high) {
            // Single element sorted
            parentTree.status = 'done';
            pushHistory({
                type: 'SORTED', array: [...arr], comps, swaps, depth: maxDepth, pivot: '-', line: 2,
                activeIndices: [low], partitionRange: null, treeNode: parentTree,
                msg: `Element ${arr[low]} is sorted.`
            });
        } else {
            parentTree.status = 'done';
            pushHistory({
                type: 'BASE_CASE', array: [...arr], comps, swaps, depth: maxDepth, pivot: '-', line: 2,
                activeIndices: [], partitionRange: null, treeNode: parentTree,
                msg: `Empty range [${low}...${high}] is already sorted.`
            });
        }
    }

    function partition(low, high, level, treeNode) {
        let pivot = arr[high];
        pushHistory({
            type: 'PIVOT', array: [...arr], comps, swaps, depth: maxDepth, pivot: pivot, line: 3,
            activeIndices: [high], partitionRange: [low, high], treeNode: treeNode,
            msg: `Pivot selected: ${pivot}`
        });

        let i = low - 1;

        for (let j = low; j <= high - 1; j++) {
            comps++;
            pushHistory({
                type: 'COMPARE', array: [...arr], comps, swaps, depth: maxDepth, pivot: pivot, line: 3,
                activeIndices: [j, high], partitionRange: [low, high], treeNode: treeNode,
                msg: `Comparing ${arr[j]} with pivot ${pivot}`
            });

            if (arr[j] < pivot) {
                i++;
                swaps++;
                let temp = arr[i];
                arr[i] = arr[j];
                arr[j] = temp;
                pushHistory({
                    type: 'SWAP', array: [...arr], comps, swaps, depth: maxDepth, pivot: pivot, line: 3,
                    activeIndices: [i, j], partitionRange: [low, high], treeNode: treeNode,
                    msg: `Swapping ${arr[i]} and ${arr[j]}`
                });
            }
        }
        
        swaps++;
        let temp = arr[i + 1];
        arr[i + 1] = arr[high];
        arr[high] = temp;
        
        pushHistory({
            type: 'SWAP', array: [...arr], comps, swaps, depth: maxDepth, pivot: arr[i+1], line: 3,
            activeIndices: [i+1, high], partitionRange: [low, high], treeNode: treeNode,
            msg: `Moving pivot to correct position: index ${i+1}`
        });
        
        pushHistory({
            type: 'SORTED', array: [...arr], comps, swaps, depth: maxDepth, pivot: arr[i+1], line: 3,
            activeIndices: [i+1], partitionRange: [low, high], treeNode: treeNode,
            msg: `Pivot ${arr[i+1]} is now sorted.`
        });

        return i + 1;
    }

    quickSort(0, arr.length - 1, 0, rootTree);
    
    // Final state
    pushHistory({
        type: 'DONE', array: [...arr], comps, swaps, depth: maxDepth, pivot: '-', line: 7,
        activeIndices: [], partitionRange: null, treeNode: rootTree,
        msg: `Array fully sorted!`
    });

    state.history = history;
    // We also need the full tree structure for rendering
    state.fullTree = rootTree;
}

// --- PLAYBACK ENGINE ---

async function playbackLoop() {
    while (state.isPlaying && state.currentStep < state.history.length - 1) {
        state.currentStep++;
        renderStep(state.history[state.currentStep]);
        updateStats();
        await waitForNextFrame(state.speed);
    }
    
    if (state.currentStep >= state.history.length - 1) {
        finishSorting();
    }
}

async function stepForward() {
    if (state.history.length === 0) generateHistory();
    if (state.currentStep < state.history.length - 1) {
        state.currentStep++;
        renderStep(state.history[state.currentStep]);
        updateStats();
    }
}

async function stepBackward() {
    if (state.currentStep > 0) {
        state.currentStep--;
        renderStep(state.history[state.currentStep]);
        updateStats();
    }
}

function finishSorting() {
    state.isPlaying = false;
    state.isSorted = true;
    clearInterval(state.timerInterval);
    DOM.barsContainer.classList.add('sort-complete');
    showInsight("QuickSort complete!");
    updateControls();
    playSound('success');
}

// --- RENDER ENGINE ---

function renderStep(step) {
    // 1. Update bars heights & classes
    const bars = DOM.barsContainer.children;
    const maxVal = Math.max(...step.array, 100);
    
    for (let i = 0; i < bars.length; i++) {
        const bar = bars[i];
        bar.style.height = `${(step.array[i] / maxVal) * 90}%`;
        if (bar.textContent !== String(step.array[i])) bar.textContent = step.array[i];
        bar.className = 'array-bar'; // reset classes
        
        // Apply partition highlighting
        if (step.partitionRange && i >= step.partitionRange[0] && i <= step.partitionRange[1]) {
            bar.classList.add('partition');
        }
    }

    // Apply specific classes
    if (step.type === 'COMPARE') {
        step.activeIndices.forEach(idx => { if(bars[idx]) bars[idx].classList.add('compare'); });
        playSound('compare');
    } else if (step.type === 'SWAP') {
        step.activeIndices.forEach(idx => { if(bars[idx]) bars[idx].classList.add('compare'); }); // highlight swap
        playSound('swap');
    } else if (step.type === 'PIVOT') {
        step.activeIndices.forEach(idx => { if(bars[idx]) bars[idx].classList.add('pivot'); });
    } else if (step.type === 'SORTED') {
        // Find all sorted elements so far. This is tricky since we only record current.
        // We'll trust history to show the current sorted one.
        step.activeIndices.forEach(idx => { if(bars[idx]) bars[idx].classList.add('sorted'); });
    }

    // 2. Update Pseudocode highlighting
    DOM.pseudocode.querySelectorAll('span').forEach(el => el.classList.remove('active-line'));
    if (step.line > 0) {
        const lineEl = document.getElementById(`line-${step.line}`);
        if(lineEl) lineEl.classList.add('active-line');
    }

    // 3. Show Insight
    if (step.msg) {
        showInsight(step.msg);
    }

    // 4. Render Tree Snapshot
    renderTree(step.treeNode);
}

function updateStats() {
    const step = state.history[state.currentStep] || state.history[0];
    if(!step) {
        setTextIfChanged(DOM.statComparisons, 0);
        setTextIfChanged(DOM.statSwaps, 0);
        setTextIfChanged(DOM.statDepth, 0);
        setTextIfChanged(DOM.statPivot, '-');
        setTextIfChanged(DOM.progressText, '0%');
        DOM.progressFill.style.width = '0%';
        DOM.statTime.textContent = '0.0s';
        return;
    }
    
    setTextIfChanged(DOM.statComparisons, step.comps);
    setTextIfChanged(DOM.statSwaps, step.swaps);
    setTextIfChanged(DOM.statDepth, step.depth);
    setTextIfChanged(DOM.statPivot, step.pivot);
    
    const progress = state.history.length > 1 ? (state.currentStep / (state.history.length - 1)) * 100 : 0;
    setTextIfChanged(DOM.progressText, `${Math.floor(progress)}%`);
    DOM.progressFill.style.width = `${progress}%`;
}

function updateControls() {
    const isReady = state.array.length > 0;
    const isEnd = state.currentStep >= (state.history.length - 1) && state.history.length > 0;
    
    DOM.btnStart.disabled = !isReady || isEnd;
    DOM.btnStart.innerHTML = state.isPlaying ? '<i class="fa-solid fa-play"></i> Playing...' : '<i class="fa-solid fa-play"></i> Start';
    if(state.isPlaying) {
        DOM.btnStart.classList.remove('btn-primary');
        DOM.btnStart.classList.add('btn-secondary');
    } else {
        DOM.btnStart.classList.add('btn-primary');
        DOM.btnStart.classList.remove('btn-secondary');
    }

    DOM.btnPause.disabled = !state.isPlaying;
    DOM.btnNext.disabled = state.isPlaying || !isReady || isEnd;
    DOM.btnPrev.disabled = state.isPlaying || state.currentStep === 0;
}

// --- TREE RENDERER ---
function renderTree(activeNode) {
    if (!state.fullTree) {
        clearTreeRender();
        return;
    }

    if (treeRenderState.rootId !== state.fullTree.id) {
        buildTreeRender(state.fullTree);
    }

    const step = state.history[state.currentStep];
    updateTreeClasses(activeNode, step?.doneNodeIds || [], step?.visibleNodeIds || []);
}

function setupTreeResizeObserver() {
    if (!window.ResizeObserver) return;

    treeRenderState.resizeObserver = new ResizeObserver(() => {
        if (!state.fullTree) return;
        treeRenderState.rootId = null;
        renderTree(state.history[state.currentStep]?.treeNode || null);
    });
    treeRenderState.resizeObserver.observe(DOM.treeContainer);
}

function clearTreeRender() {
    DOM.treeNodes.innerHTML = '';
    DOM.treeSvg.innerHTML = '';
    DOM.treeEmpty.classList.remove('hidden');
    treeRenderState.rootId = null;
    treeRenderState.activeId = null;
    treeRenderState.doneIds.clear();
    treeRenderState.nodeElements.clear();
    treeRenderState.linkElements.clear();
}

function buildTreeRender(root) {
    clearTreeRender();
    DOM.treeEmpty.classList.add('hidden');
    treeRenderState.rootId = root.id;

    const nodes = flattenTree(root);
    const levels = new Map();
    nodes.forEach(node => {
        if (!levels.has(node.level)) levels.set(node.level, []);
        levels.get(node.level).push(node);
    });

    const nodeWidth = 84;
    const nodeHeight = 34;
    const xGap = 24;
    const yGap = 58;
    const maxLevelCount = Math.max(...Array.from(levels.values(), level => level.length), 1);
    const contentWidth = Math.max(DOM.treeContainer.clientWidth, maxLevelCount * (nodeWidth + xGap) + 48);
    const contentHeight = Math.max(DOM.treeContainer.clientHeight, levels.size * (nodeHeight + yGap) + 32);
    const positions = new Map();
    const nodeFragment = document.createDocumentFragment();
    const linkFragment = document.createDocumentFragment();

    DOM.treeNodes.style.width = `${contentWidth}px`;
    DOM.treeNodes.style.height = `${contentHeight}px`;
    DOM.treeSvg.setAttribute('viewBox', `0 0 ${contentWidth} ${contentHeight}`);
    DOM.treeSvg.style.width = `${contentWidth}px`;
    DOM.treeSvg.style.height = `${contentHeight}px`;

    levels.forEach((levelNodes, level) => {
        const rowWidth = (levelNodes.length - 1) * (nodeWidth + xGap);
        const startX = contentWidth / 2 - rowWidth / 2;
        const y = 18 + level * (nodeHeight + yGap);

        levelNodes.forEach((node, index) => {
            const x = startX + index * (nodeWidth + xGap);
            positions.set(node.id, { x, y });

            const el = document.createElement('div');
            el.className = 'tree-node';
            el.textContent = `[${node.low}..${node.high}]`;
            el.style.setProperty('--tree-x', `${x}px`);
            el.style.setProperty('--tree-y', `${y}px`);
            nodeFragment.appendChild(el);
            treeRenderState.nodeElements.set(node.id, el);
        });
    });

    nodes.forEach(node => {
        if (!node.children) return;

        node.children.forEach(child => {
            const from = positions.get(node.id);
            const to = positions.get(child.id);
            if (!from || !to) return;

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', from.x + nodeWidth / 2);
            line.setAttribute('y1', from.y + nodeHeight);
            line.setAttribute('x2', to.x + nodeWidth / 2);
            line.setAttribute('y2', to.y);
            line.setAttribute('class', 'tree-link');
            linkFragment.appendChild(line);
            treeRenderState.linkElements.set(`${node.id}-${child.id}`, line);
        });
    });

    DOM.treeSvg.appendChild(linkFragment);
    DOM.treeNodes.appendChild(nodeFragment);
}

function flattenTree(root) {
    const nodes = [];
    const queue = [root];

    while (queue.length) {
        const node = queue.shift();
        nodes.push(node);
        if (node.children) queue.push(...node.children);
    }

    return nodes;
}

function updateTreeClasses(activeNode, doneNodeIds, visibleNodeIds) {
    const activeId = activeNode?.id || null;
    const nextDoneIds = new Set(doneNodeIds);
    const nextVisibleIds = new Set(visibleNodeIds);

    treeRenderState.nodeElements.forEach((el, id) => {
        const isVisible = nextVisibleIds.has(id);
        el.classList.toggle('visible', isVisible);
        el.classList.toggle('hidden', !isVisible);
    });

    treeRenderState.linkElements.forEach((line, key) => {
        const [parentId, childId] = key.split('-').map(Number);
        line.classList.toggle('visible', nextVisibleIds.has(parentId) && nextVisibleIds.has(childId));
    });

    if (treeRenderState.activeId && treeRenderState.activeId !== activeId) {
        treeRenderState.nodeElements.get(treeRenderState.activeId)?.classList.remove('active');
    }
    if (activeId) treeRenderState.nodeElements.get(activeId)?.classList.add('active');
    treeRenderState.activeId = activeId;

    treeRenderState.nodeElements.forEach((el, id) => {
        if (nextDoneIds.has(id) && !treeRenderState.doneIds.has(id)) {
            el.classList.add('done');
            treeRenderState.doneIds.add(id);
        } else if (!nextDoneIds.has(id) && treeRenderState.doneIds.has(id)) {
            el.classList.remove('done');
            treeRenderState.doneIds.delete(id);
        }
    });

    treeRenderState.linkElements.forEach(line => line.classList.remove('active'));
    if (!activeId) return;

    getPathToNode(state.fullTree, activeId).forEach(([parentId, childId]) => {
        treeRenderState.linkElements.get(`${parentId}-${childId}`)?.classList.add('active');
    });
}

function getPathToNode(root, id, path = []) {
    if (!root || root.id === id) return path;

    for (const child of root.children || []) {
        const nextPath = [...path, [root.id, child.id]];
        if (child.id === id) return nextPath;

        const match = getPathToNode(child, id, nextPath);
        if (match.length && match[match.length - 1][1] === id) return match;
    }

    return [];
}

function collectDoneNodeIds(root) {
    if (!root) return [];

    return flattenTree(root)
        .filter(node => node.status === 'done')
        .map(node => node.id);
}

function collectVisibleNodeIds(root) {
    if (!root) return [];

    return flattenTree(root).map(node => node.id);
}

// --- UTILS ---

function showInsight(text) {
    DOM.insightText.textContent = text;
    DOM.insightToast.classList.remove('hidden');
}

function hideInsight() {
    DOM.insightToast.classList.add('hidden');
}

function waitForNextFrame(ms) {
    return new Promise(resolve => {
        window.setTimeout(() => window.requestAnimationFrame(resolve), ms);
    });
}

function getPlaybackDelay(value) {
    return 1010 - (Number(value) * 10);
}

function setTextIfChanged(element, value) {
    const text = String(value);
    if (element.textContent !== text) element.textContent = text;
}

// Simple Web Audio API sound generator
function playSound(type) {
    if (!state.audioCtx) {
        state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if(state.audioCtx.state === 'suspended') state.audioCtx.resume();
    
    const osc = state.audioCtx.createOscillator();
    const gainNode = state.audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(state.audioCtx.destination);
    
    if (type === 'compare') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, state.audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.05, state.audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, state.audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(state.audioCtx.currentTime + 0.1);
    } else if (type === 'swap') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, state.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, state.audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, state.audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, state.audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(state.audioCtx.currentTime + 0.1);
    } else if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, state.audioCtx.currentTime);
        osc.frequency.setValueAtTime(554.37, state.audioCtx.currentTime + 0.2); // C#
        osc.frequency.setValueAtTime(659.25, state.audioCtx.currentTime + 0.4); // E
        gainNode.gain.setValueAtTime(0.2, state.audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, state.audioCtx.currentTime + 1.0);
        osc.start();
        osc.stop(state.audioCtx.currentTime + 1.0);
    }
}

// Start app
init();
