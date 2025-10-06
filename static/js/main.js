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