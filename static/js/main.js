// 전역 변수로 스케줄 데이터 저장
let globalScheduleData = null;

function updateCurrentTime() {
    const now = new Date();
    const formattedTime = now.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    document.getElementById('current-time-display').textContent = formattedTime;
}

async function loadScheduleData() {
    if (globalScheduleData) {
        return globalScheduleData;
    }

    try {
        const timestamp = new Date().getTime();
        const response = await fetch(`/schedules/bus_time.csv?v=${timestamp}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const csvText = await response.text();
        const rows = csvText.split('\n').slice(1);
        
        const scheduleData = {
            weekdayData: {
                schoolToStation: [],
                stationToSchool: []
            },
            sundayData: {
                schoolToStation: [],
                stationToSchool: []
            },
            osongData: []
        };

        rows.forEach(row => {
            if (!row.trim()) return;
            
            const [departure, route, type, note] = row.split(',');
            const scheduleItem = {
                departure: departure,
                note: note
            };

            if (type === 'Weekday') {
                if (route === 'School_to_Station') {
                    scheduleData.weekdayData.schoolToStation.push(scheduleItem);
                } else if (route === 'Station_to_School') {
                    scheduleData.weekdayData.stationToSchool.push(scheduleItem);
                } else if (route.includes('Osong')) {
                    scheduleData.osongData.push(scheduleItem);
                }
            } else if (type === 'Sunday') {
                if (route === 'School_to_Station') {
                    scheduleData.sundayData.schoolToStation.push(scheduleItem);
                } else if (route === 'Station_to_School') {
                    scheduleData.sundayData.stationToSchool.push(scheduleItem);
                }
            }
        });

        globalScheduleData = scheduleData;
        return scheduleData;
    } catch (error) {
        console.error('시간표 데이터를 불러오는데 실패했습니다:', error);
        document.querySelectorAll('.bus-section div[id]').forEach(el => {
            el.innerHTML = '<div class="next-bus-time no-bus">시간표를 불러오는데 실패했습니다.</div>';
        });
        return null;
    }
}

function calculateRemainingTime(departureTime) {
    const now = new Date();
    const [hours, minutes] = departureTime.split(':').map(Number);

    if (isNaN(hours) || isNaN(minutes)) {
        return null;
    }

    const departureDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
    
    if (departureDate < now) {
        return null;
    }

    const diffMilliseconds = departureDate - now;
    const diffHours = Math.floor(diffMilliseconds / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMilliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const diffSeconds = Math.floor((diffMilliseconds % (1000 * 60)) / 1000);

    return {
        hours: diffHours,
        minutes: diffMinutes,
        seconds: diffSeconds
    };
}

function isFridayNoServiceTime(route, departure) {
    const [hours, minutes] = departure.split(':').map(Number);
    
    const schoolToStationNoService = [
        {hours: 19, minutes: 10},
        {hours: 19, minutes: 40},
        {hours: 20, minutes: 10},
        {hours: 20, minutes: 50}
    ];
    
    const stationToSchoolNoService = [
        {hours: 19, minutes: 20},
        {hours: 19, minutes: 50},
        {hours: 20, minutes: 20},
        {hours: 21, minutes: 0}
    ];
    
    const noServiceTimes = route === 'schoolToStation' 
        ? schoolToStationNoService 
        : stationToSchoolNoService;
    
    return noServiceTimes.some(noService => 
        hours === noService.hours && minutes === noService.minutes
    );
}

function findNextBuses(scheduleList, count = 3, route = '') {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const isFriday = now.getDay() === 5;

    return scheduleList
        .filter(schedule => {
            const [hours, minutes] = schedule.departure.split(':').map(Number);
            const scheduleTime = hours * 60 + minutes;
            
            if (isFriday && (route === 'schoolToStation' || route === 'stationToSchool') && 
                isFridayNoServiceTime(route, schedule.departure)) {
                schedule.note = (schedule.note || '') + ' (금요일 미운행)';
            }
            
            return scheduleTime >= currentTime;
        })
        .slice(0, count);
}

function displayNextBuses(buses, elementId) {
    const container = document.getElementById(elementId);
    if (!container) return;
    container.innerHTML = '';

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (!buses || buses.length === 0) {
        container.innerHTML = '<div class="no-buses">운행 예정인 버스가 없습니다.</div>';
        return;
    }

    buses.forEach(bus => {
        const isFridayNoService = bus.note && bus.note.includes('금요일 미운행');
        const busElement = document.createElement('div');
        busElement.className = 'next-bus-time';

        if (isMobile) {
            busElement.style.touchAction = 'manipulation';
            busElement.addEventListener('touchstart', function(e) {
                e.preventDefault();
            }, {passive: false});
        }

        if (isFridayNoService) {
            busElement.innerHTML = `
                <div class="time-info friday-no-service">
                    <div class="time-row">
                        <span class="time-label">출발</span>
                        <span class="departure-time">${bus.departure}</span>
                    </div>
                    <div class="note">금요일 미운행</div>
                </div>`;
        } else {
            const remainingTime = calculateRemainingTime(bus.departure);
            if (!remainingTime) return;

            const isImminent = remainingTime.hours === 0 && remainingTime.minutes <= 4 && remainingTime.minutes >= 0;
            
            let formattedTime;
            if (elementId === 'nextOsongBuses' || remainingTime.hours > 0) {
                formattedTime = `남은 시간: ${String(remainingTime.hours).padStart(2, '0')}:${String(remainingTime.minutes).padStart(2, '0')}:${String(remainingTime.seconds).padStart(2, '0')}`;
            } else {
                formattedTime = `남은 시간: ${String(remainingTime.minutes).padStart(2, '0')}:${String(remainingTime.seconds).padStart(2, '0')}`;
            }
            
            busElement.innerHTML = `
                <div class="time-info ${isImminent ? 'imminent' : ''}">
                    <div class="time-row">
                        <span class="time-label">출발</span>
                        <span class="departure-time">${bus.departure}</span>
                    </div>
                    <div class="countdown-display">${formattedTime}</div>
                    ${bus.note ? `<div class="note">${bus.note}</div>` : ''}
                </div>`;
        }
            
        container.appendChild(busElement);
    });
}

async function updateBusSchedules() {
    const scheduleData = await loadScheduleData();
    if (!scheduleData) return;

    const now = new Date();
    const day = now.getDay();
    const isSaturday = day === 6;
    const isSunday = day === 0;

    if (isSaturday) {
        // 토요일인 경우 모든 노선에 운행 없음 표시
        const noServiceMessage = '<div class="no-buses">토요일은 셔틀버스 운행이 없습니다.</div>';
        document.getElementById('nextSchoolToStation').innerHTML = noServiceMessage;
        document.getElementById('nextStationToSchool').innerHTML = noServiceMessage;
        document.getElementById('nextOsongBuses').innerHTML = noServiceMessage;
    } else if (isSunday) {
        // 기존 일요일 로직
        const nextSchoolToStation = findNextBuses(scheduleData.sundayData.schoolToStation, 3);
        const nextStationToSchool = findNextBuses(scheduleData.sundayData.stationToSchool, 3);

        displayNextBuses(nextSchoolToStation, 'nextSchoolToStation');
        displayNextBuses(nextStationToSchool, 'nextStationToSchool');
        displayNextBuses([], 'nextOsongBuses');
    } else {
        // 기존 평일 로직
        const nextSchoolToStation = findNextBuses(scheduleData.weekdayData.schoolToStation, 3, 'schoolToStation');
        const nextStationToSchool = findNextBuses(scheduleData.weekdayData.stationToSchool, 3, 'stationToSchool');
        const nextOsong = findNextBuses(scheduleData.osongData, 3, 'osong');

        displayNextBuses(nextSchoolToStation, 'nextSchoolToStation');
        displayNextBuses(nextStationToSchool, 'nextStationToSchool');
        displayNextBuses(nextOsong, 'nextOsongBuses');
    }
}

// JavaScript 파일 자체의 캐시 방지
document.addEventListener('DOMContentLoaded', function() {
    const scripts = document.getElementsByTagName('script');
    for (let script of scripts) {
        if (script.src && script.src.includes('main.js')) {
            const timestamp = new Date().getTime();
            script.src = script.src.split('?')[0] + '?v=' + timestamp;
        }
    }
});

// 초기 로드
updateCurrentTime();
updateBusSchedules();

// 시간 업데이트 간격 설정
setInterval(updateCurrentTime, 500);
setInterval(updateBusSchedules, 500);

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const calendarFab = document.getElementById('calendar-fab');
    const modalOverlay = document.getElementById('calendar-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');
    const goToTodayBtn = document.getElementById('go-to-today');
    const calendarTitleContainer = document.getElementById('calendar-title-container');
    const calendarTitle = document.getElementById('calendar-title');
    const calendarBody = document.getElementById('calendar-body');
    const scheduleDisplay = document.getElementById('schedule-display');
    const datePicker = document.getElementById('date-picker');
    const yearSelect = document.getElementById('year-select');
    const monthSelect = document.getElementById('month-select');
    const arrowIcon = document.querySelector('.arrow-down');
    const scrollGuide = document.querySelector('.scroll-guide');
    const scrollIndicator = document.querySelector('.scroll-indicator');
    const scrollIndicatorThumb = document.querySelector('.scroll-indicator-thumb');

    // State
    const today = new Date();
    let displayDate = new Date(); // Calendar view's current month/year
    let selectedDate = new Date(); // The actively clicked date
    const holidaysCache = new Map();
    let scheduleData = new Map();
    let scrollTimeout;

    // --- Data Loading ---
    async function getHolidays(year) {
        if (holidaysCache.has(year)) return holidaysCache.get(year);
        const serviceKey = 'YOUR_SERVICE_KEY'; // Use your own service key for production.
        const url = `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?solYear=${year}&_type=json&serviceKey=${serviceKey}&numOfRows=50`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok.');
            const data = await response.json();
            if (!data.response.body.items || data.response.body.items.item === undefined) {
                 holidaysCache.set(year, new Map()); return new Map();
            }
            const items = data.response.body.items.item;
            const holidays = new Map();
            (Array.isArray(items) ? items : [items]).forEach(item => {
                const dateStr = item.locdate.toString();
                const formatted = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
                holidays.set(formatted, item.dateName);
            });
            holidaysCache.set(year, holidays);
            return holidays;
        } catch (error) {
            console.error('Fetching holidays failed:', error);
            holidaysCache.set(year, new Map()); return new Map();
        }
    }

    async function loadAndParseSchedule() {
        try {
            const response = await fetch('/schedules/Calendar.csv');
            const csvText = await response.text();
            const lines = csvText.trim().split('\n');
            lines.forEach(line => {
                const parts = line.split(',');
                if (parts.length < 4) return;
                const year = parts[0];
                const month = parts[1];
                const dayRange = parts[2];
                const description = parts.slice(3).join(',');

                if (dayRange.includes('~')) {
                    const [start, end] = dayRange.split('~').map(Number);
                    for (let day = start; day <= end; day++) {
                        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        if (!scheduleData.has(dateStr)) scheduleData.set(dateStr, []);
                        scheduleData.get(dateStr).push(description);
                    }
                } else {
                    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayRange).padStart(2, '0')}`;
                    if (!scheduleData.has(dateStr)) scheduleData.set(dateStr, []);
                    scheduleData.get(dateStr).push(description);
                }
            });
        } catch (error) {
            console.error("Failed to load or parse schedule CSV:", error);
        }
    }

    // --- 스크롤 인디케이터 업데이트 ---
    function updateScrollIndicator() {
        const hasScroll = scheduleDisplay.scrollHeight > scheduleDisplay.clientHeight;
        
        if (hasScroll) {
            scrollIndicator.classList.add('visible');
            
            // 스크롤바 thumb 높이와 위치 계산
            const scrollRatio = scheduleDisplay.clientHeight / scheduleDisplay.scrollHeight;
            const thumbHeight = Math.max(20, scrollIndicator.clientHeight * scrollRatio);
            const maxScroll = scheduleDisplay.scrollHeight - scheduleDisplay.clientHeight;
            const scrollPercentage = scheduleDisplay.scrollTop / maxScroll;
            const maxThumbTop = scrollIndicator.clientHeight - thumbHeight;
            const thumbTop = maxThumbTop * scrollPercentage;
            
            scrollIndicatorThumb.style.height = `${thumbHeight}px`;
            scrollIndicatorThumb.style.top = `${thumbTop}px`;
        } else {
            scrollIndicator.classList.remove('visible');
        }
    }

    // --- UI Rendering & Logic ---
    function checkScrollVisibility() {
        const hasScroll = scheduleDisplay.scrollHeight > scheduleDisplay.clientHeight;
        
        if (hasScroll) {
            scrollGuide.classList.add('visible');
        } else {
            scrollGuide.classList.remove('visible');
        }
        
        // 스크롤 인디케이터 업데이트
        updateScrollIndicator();
    }

    function displayScheduleForDate(date) {
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const schedules = scheduleData.get(dateStr);
        let content = `<div class="schedule-date">${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일</div>`;

        if (schedules && schedules.length > 0) {
            content += schedules.map(item => `<div class="schedule-item">${item}</div>`).join('');
        } else {
            content += '<div class="no-schedule">학사일정이 없습니다.</div>';
        }
        scheduleDisplay.innerHTML = content;
        
        // 스크롤 가이드와 인디케이터 업데이트
        checkScrollVisibility();
    }
    
    function updateActiveCell() {
        const prevActive = calendarBody.querySelector('.active-date');
        if (prevActive) prevActive.classList.remove('active-date');
        
        if (selectedDate.getFullYear() === displayDate.getFullYear() && selectedDate.getMonth() === displayDate.getMonth()) {
            const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
            const targetCell = calendarBody.querySelector(`[data-date="${dateStr}"]`);
            if(targetCell) targetCell.classList.add('active-date');
        }
    }

    async function renderCalendar() {
        const year = displayDate.getFullYear();
        const month = displayDate.getMonth();
        const holidays = await getHolidays(year);
        calendarTitle.textContent = `${year}년 ${month + 1}월`;
        calendarBody.innerHTML = '';

        const firstDayIndex = new Date(year, month, 1).getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();
        const prevMonthLastDate = new Date(year, month, 0).getDate();
        const totalCells = 42;

        for (let i = firstDayIndex; i > 0; i--) {
            calendarBody.insertAdjacentHTML('beforeend', `<div class="date-cell other-month">${prevMonthLastDate - i + 1}</div>`);
        }

        for (let day = 1; day <= lastDate; day++) {
            const fullDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayOfWeek = new Date(year, month, day).getDay();
            
            let classes = ['date-cell'];
            if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) classes.push('today');
            if (holidays.has(fullDateStr)) classes.push('holiday');
            else if (dayOfWeek === 0) classes.push('sunday');
            else if (dayOfWeek === 6) classes.push('saturday');
            
            if (scheduleData.has(fullDateStr)) classes.push('has-schedule');

            const holidayName = holidays.get(fullDateStr) || '';
            calendarBody.insertAdjacentHTML('beforeend', `<div class="${classes.join(' ')}" data-date="${fullDateStr}" title="${holidayName}">${day}</div>`);
        }
        
        const currentCells = firstDayIndex + lastDate;
        for (let i = 1; i <= totalCells - currentCells; i++) {
             calendarBody.insertAdjacentHTML('beforeend', `<div class="date-cell other-month">${i}</div>`);
        }
        updateActiveCell();
    }
    
    // --- Date Picker ---
    function toggleDatePicker(show) {
        if(show) {
            datePicker.classList.add('visible');
            arrowIcon.classList.add('up');
            yearSelect.value = displayDate.getFullYear();
            updateActiveMonthButton();
        } else {
            datePicker.classList.remove('visible');
            arrowIcon.classList.remove('up');
        }
    }

    function updateActiveMonthButton(){
        document.querySelectorAll('.month-button').forEach(btn => {
            btn.classList.remove('active');
            if(parseInt(btn.dataset.month) === displayDate.getMonth()){
                btn.classList.add('active');
            }
        });
    }

    function initDatePicker() {
        const currentYear = today.getFullYear();
        for (let i = currentYear - 10; i <= currentYear + 10; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${i}년`;
            yearSelect.appendChild(option);
        }

        for (let i = 0; i < 12; i++) {
            const button = document.createElement('div');
            button.textContent = `${i + 1}월`;
            button.classList.add('month-button');
            button.dataset.month = i;
            monthSelect.appendChild(button);
            button.addEventListener('click', () => {
                displayDate.setMonth(i);
                renderCalendar();
                toggleDatePicker(false);
            });
        }

        yearSelect.addEventListener('change', () => {
            displayDate.setFullYear(parseInt(yearSelect.value));
            updateActiveMonthButton();
        });
    }

    // --- Event Listeners ---
    calendarFab.addEventListener('click', () => {
        selectedDate = new Date();
        displayDate = new Date();
        modalOverlay.style.display = 'flex';
        setTimeout(() => {
            modalOverlay.classList.add('visible');
            renderCalendar().then(() => {
                displayScheduleForDate(selectedDate);
            });
        }, 10);
    });
    
    const closeModal = () => {
        modalOverlay.classList.remove('visible');
        setTimeout(() => modalOverlay.style.display = 'none', 300);
        toggleDatePicker(false);
    };

    closeModalBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    prevMonthBtn.addEventListener('click', () => {
        displayDate.setMonth(displayDate.getMonth() - 1);
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
        displayDate.setMonth(displayDate.getMonth() + 1);
        renderCalendar();
    });
    
    goToTodayBtn.addEventListener('click', () => {
        displayDate = new Date();
        selectedDate = new Date();
        renderCalendar().then(() => {
            displayScheduleForDate(selectedDate);
        });
        toggleDatePicker(false);
    });
    
    calendarBody.addEventListener('click', (e) => {
        const target = e.target.closest('.date-cell:not(.other-month)');
        if (!target) return;
        
        const dateStr = target.dataset.date;
        const [year, month, day] = dateStr.split('-').map(Number);
        
        selectedDate = new Date(year, month - 1, day);
        updateActiveCell();
        displayScheduleForDate(selectedDate);
    });

    calendarTitleContainer.addEventListener('click', () => {
        toggleDatePicker(!datePicker.classList.contains('visible'));
    });

    // 스크롤 이벤트 리스너 (스크롤 가이드 숨김 & 인디케이터 업데이트)
    scheduleDisplay.addEventListener('scroll', () => {
        // 스크롤 가이드 숨김
        if (scrollGuide.classList.contains('visible')) {
            scrollGuide.classList.remove('visible');
        }
        
        // 스크롤 인디케이터 업데이트
        updateScrollIndicator();
        
        // 스크롤 중 표시
        scrollIndicatorThumb.classList.add('scrolling');
        
        // 스크롤 멈춤 감지
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            scrollIndicatorThumb.classList.remove('scrolling');
        }, 150);
    });

    // 윈도우 리사이즈 시 스크롤 인디케이터 업데이트
    window.addEventListener('resize', () => {
        if (scheduleDisplay.scrollHeight > 0) {
            updateScrollIndicator();
        }
    });

    // --- Initial Load ---
    loadAndParseSchedule();
    initDatePicker();
});