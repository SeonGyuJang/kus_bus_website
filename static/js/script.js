async function loadBusSchedule() {
    try {
        const response = await fetch('/schedules/bus_time.csv');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.text();
        const rows = data.split('\n').map(row => row.split(','));
        
        // 헤더 제거
        const scheduleData = rows.slice(1);
        
        // PC 환경인지 확인
        const isPc = window.innerWidth > 768;
        
        // 평일 시간표
        const schoolToStationWeekday = document.getElementById('school-to-station-weekday');
        const stationToSchoolWeekday = document.getElementById('station-to-school-weekday');
        
        // PC 환경일 때 학교->조치원(평일) 테이블에만 빈 행 2개 추가
        if (isPc) {
            const tableBody = document.getElementById('school-to-station-weekday');
            for (let i = 0; i < 2; i++) {
                const emptyTr = document.createElement('tr');
                emptyTr.innerHTML = `
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                `;
                tableBody.appendChild(emptyTr);
            }
        }
        
        scheduleData.forEach(row => {
            if (row.length >= 3) {
                const [departure, route, type, note] = row;
                if (type.trim() === 'Weekday') {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${departure}</td>
                        <td>${note || ''}</td>
                    `;
                    
                    if (route === 'School_to_Station') {
                        schoolToStationWeekday.appendChild(tr);
                    } else if (route === 'Station_to_School') {
                        stationToSchoolWeekday.appendChild(tr);
                    }
                }
            }
        });

        // 일요일 시간표
        const schoolToStationSunday = document.getElementById('school-to-station-sunday');
        const stationToSchoolSunday = document.getElementById('station-to-school-sunday');
        
        // PC 환경일 때 학교->조치원(일요일) 테이블에만 빈 행 1개 추가
        if (isPc) {
            const tableBody = document.getElementById('school-to-station-sunday');
            const emptyTr = document.createElement('tr');
            emptyTr.innerHTML = `
                <td>&nbsp;</td>
                <td>&nbsp;</td>
            `;
            tableBody.appendChild(emptyTr);
        }
        
        scheduleData.forEach(row => {
            if (row.length >= 3) {
                const [departure, route, type, note] = row;
                if (type.trim() === 'Sunday') {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${departure}</td>
                        <td>${note || ''}</td>
                    `;
                    
                    if (route === 'School_to_Station') {
                        schoolToStationSunday.appendChild(tr);
                    } else if (route === 'Station_to_School') {
                        stationToSchoolSunday.appendChild(tr);
                    }
                }
            }
        });

        // 오송역 시간표
        const osongTableBody = document.getElementById('osong-schedule');
        scheduleData.forEach(row => {
            if (row.length >= 3) {
                const [departure, route, type, note] = row;
                if (route.includes('Osong')) {
                    const tr = document.createElement('tr');
                    let routeText = '';
                    
                    if (route === 'Osong_to_School') {
                        routeText = '오송역 → 조치원역 → 학교';
                    } else if (route === 'Station_to_Osong') {
                        routeText = '조치원역 → 오송역 → 조치원역';
                    } else if (route === 'School_to_Osong') {
                        routeText = '학교 → 조치원역 → 오송역';
                    }

                    tr.innerHTML = `
                        <td>${departure}</td>
                        <td>${routeText}</td>
                        <td>${note || ''}</td>
                    `;
                    osongTableBody.appendChild(tr);
                }
            }
        });
    } catch (error) {
        console.error('시간표를 불러오는 중 오류:', error);
        const errorMessage = '<tr><td colspan="2">시간표를 불러오는데 실패했습니다. 잠시 후 다시 시도해주세요.</td></tr>';
        ['school-to-station-weekday', 'station-to-school-weekday', 
         'school-to-station-sunday', 'station-to-school-sunday'].forEach(id => {
            document.getElementById(id).innerHTML = errorMessage;
        });
        document.getElementById('osong-schedule').innerHTML = 
            '<tr><td colspan="3">시간표를 불러오는데 실패했습니다. 잠시 후 다시 시도해주세요.</td></tr>';
    }
}

function showRoute(routeId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    
    document.getElementById(routeId).style.display = 'block';
}

document.addEventListener('DOMContentLoaded', function() {
    const buttons = document.querySelectorAll('.uniform-button');
    
    buttons.forEach(button => {
        button.addEventListener('click', function() {
            // 같은 그룹 내의 모든 버튼에서 active 클래스 제거
            const parentContainer = this.closest('.button-container');
            const siblingButtons = parentContainer.querySelectorAll('.uniform-button');
            siblingButtons.forEach(btn => {
                btn.classList.remove('active');
            });
            
            // 클릭된 버튼에만 active 클래스 추가
            this.classList.add('active');
        });
    });
});

window.addEventListener('load', loadBusSchedule);