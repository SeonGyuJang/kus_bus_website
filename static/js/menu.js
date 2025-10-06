async function loadMenuData() {
    try {
        document.getElementById('loading-indicator').style.display = 'block';
        document.getElementById('error-message').style.display = 'none';

        console.log('메뉴 데이터 로딩 시작');
        const response = await fetch('/api/menu');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || '메뉴 데이터를 불러오는데 실패했습니다.');
        }

        const menuData = data.data;
        console.log('불러온 메뉴 데이터:', menuData);
        
        // 주간 정보 업데이트
        if (menuData.학생식당 && menuData.학생식당.기간) {
            updateWeekInfo(menuData.학생식당.기간);
        }
        
        // 학생식당 메뉴 업데이트
        if (menuData.학생식당) {
            updateStudentMenu(menuData.학생식당);
        }
        
        // 교직원 식당 메뉴 업데이트
        if (menuData.교직원식당) {
            updateStaffMenu(menuData.교직원식당);
        }
        
    } catch (error) {
        console.error('메뉴 데이터를 불러오는데 실패했습니다:', error);
        handleError(error);
    } finally {
        document.getElementById('loading-indicator').style.display = 'none';
    }
}

function updateWeekInfo(period) {
    if (period && period.시작일 && period.종료일) {
        const weekInfo = document.querySelector('.week-info h3');
        if (weekInfo) {
            weekInfo.textContent = `${period.시작일} ~ ${period.종료일} 메뉴`;
            console.log('기간 정보 업데이트 완료:', period);
        } else {
            console.error('week-info h3 요소를 찾을 수 없습니다.');
        }
    } else {
        console.error('기간 정보가 올바르지 않습니다:', period);
    }
}

function updateStudentMenu(menuData) {
    console.log('학생식당 메뉴 업데이트 시작:', menuData);
    if (!menuData || !menuData.메뉴) {
        console.error('메뉴 데이터가 없습니다.');
        return;
    }

    const tbody = document.querySelector('#studentCafeteria .menu-table tbody');
    if (!tbody) {
        console.error('학생식당 메뉴 테이블을 찾을 수 없습니다.');
        return;
    }

    // 테이블 초기화
    tbody.innerHTML = '';

    // 식사 종류 및 시간 정의
    const mealTypes = [
        { type: '조식', time: '07:30~09:00' },
        { type: '중식-한식', time: '11:30~13:30' },
        { type: '중식-일품', time: '11:30~13:30' },
        { type: '중식-plus', time: '11:30~13:30' },
        { type: '중식-분식', time: '11:30~13:30' },
        { type: '석식', time: '17:30~18:30' }
    ];

    // 각 식사 종류별 행 생성
    mealTypes.forEach(meal => {
        const row = document.createElement('tr');
        const th = document.createElement('th');
        th.innerHTML = `${meal.type}<br>(${meal.time})`;
        row.appendChild(th);

        // 5일치 빈 셀 추가
        for (let i = 0; i < 5; i++) {
            const td = document.createElement('td');
            row.appendChild(td);
        }

        tbody.appendChild(row);
    });

    // 메뉴 데이터 채우기
    const dayOrder = ['월', '화', '수', '목', '금'];
    
    Object.entries(menuData.메뉴).forEach(([dateStr, dayMenus]) => {
        if (dateStr === '기간') return;
        
        console.log(`처리중인 날짜와 메뉴: ${dateStr}`, dayMenus);
        
        const dayMatch = dateStr.match(/\(([월화수목금])\)/);
        if (!dayMatch) {
            console.log(`날짜 형식 불일치: ${dateStr}`);
            return;
        }

        const day = dayMatch[1];
        const dayIndex = dayOrder.indexOf(day);
        if (dayIndex === -1) {
            console.log(`유효하지 않은 요일: ${day}`);
            return;
        }

        // 모든 메뉴 타입에 대해 처리
        mealTypes.forEach((meal, rowIndex) => {
            if (dayMenus[meal.type] && dayMenus[meal.type].메뉴) {
                const cell = tbody.rows[rowIndex]?.cells[dayIndex + 1];
                if (cell) {
                    cell.innerHTML = dayMenus[meal.type].메뉴
                        .map(item => `<div class="menu-item">${item}</div>`)
                        .join('');
                }
            }
        });
    });
}

function updateStaffMenu(menuData) {
    console.log('교직원식당 메뉴 업데이트:', menuData);
    if (!menuData || !menuData.메뉴) return;

    const tbody = document.querySelector('#staffCafeteria .menu-table tbody');
    if (!tbody) return;

    const dayOrder = ['월', '화', '수', '목', '금'];
    
    Object.entries(menuData.메뉴).forEach(([dateStr, dayMenus]) => {
        if (dateStr === '기간') return;
        
        const dayMatch = dateStr.match(/\(([월화수목금])\)/);
        if (!dayMatch) return;

        const day = dayMatch[1];
        const dayIndex = dayOrder.indexOf(day);
        if (dayIndex === -1) return;

        if (dayMenus.중식 && dayMenus.중식.메뉴) {
            const cell = tbody.rows[0].cells[dayIndex + 1];
            if (cell) {
                if (Array.isArray(dayMenus.중식.메뉴)) {
                    cell.innerHTML = dayMenus.중식.메뉴
                        .map(item => `<div class="menu-item">${item}</div>`)
                        .join('');
                }
            }
        }
    });
}

function handleError(error) {
    const errorElement = document.getElementById('error-message');
    errorElement.style.display = 'block';
    errorElement.innerHTML = `<p>식단표를 불러오는데 실패했습니다. (${error.message})</p>`;
    
    const studentTbody = document.querySelector('#studentCafeteria .menu-table tbody');
    if (studentTbody) {
        studentTbody.innerHTML = `
            <tr>
                <th>조식<br>(07:30~09:00)</th>
                <td colspan="5">메뉴를 불러오는데 실패했습니다.</td>
            </tr>
            <tr>
                <th>중식<br>(11:30~13:30)</th>
                <td colspan="5">메뉴를 불러오는데 실패했습니다.</td>
            </tr>
            <tr>
                <th>석식<br>(17:30~18:30)</th>
                <td colspan="5">메뉴를 불러오는데 실패했습니다.</td>
            </tr>
        `;
    }

    const staffTbody = document.querySelector('#staffCafeteria .menu-table tbody');
    if (staffTbody) {
        staffTbody.innerHTML = `
            <tr>
                <th>중식<br>(11:30~13:30)</th>
                <td colspan="5">메뉴를 불러오는데 실패했습니다.</td>
            </tr>
        `;
    }
}

function addSwipeGuide() {
    const menuContents = document.querySelectorAll('.menu-content');
    
    menuContents.forEach(content => {
        const swipeGuide = document.createElement('div');
        swipeGuide.className = 'swipe-guide';
        swipeGuide.innerHTML = `
            <div class="swipe-guide-text">
                <span class="swipe-icon">←</span>
                옆으로 스와이프하시면, <br> 다른 요일의 메뉴도 보실 수 있습니다.
                <span class="swipe-icon">→</span>
            </div>
        `;
        
        content.insertBefore(swipeGuide, content.firstChild);

        let isGuideRemoved = false;
        content.addEventListener('scroll', () => {
            if (!isGuideRemoved && content.scrollLeft > 0) {
                swipeGuide.style.animation = 'fadeOut 0.5s ease-in-out forwards';
                setTimeout(() => {
                    swipeGuide.remove();
                }, 500);
                isGuideRemoved = true;
            }
        });

        let touchStartX = 0;
        content.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
        });

        content.addEventListener('touchmove', (e) => {
            if (isGuideRemoved) return;
            
            const touchEndX = e.touches[0].clientX;
            const diffX = touchStartX - touchEndX;

            if (Math.abs(diffX) > 30) {
                swipeGuide.style.animation = 'fadeOut 0.5s ease-in-out forwards';
                setTimeout(() => {
                    swipeGuide.remove();
                }, 500);
                isGuideRemoved = true;
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM 로드됨, 메뉴 데이터 로드 시작');
    loadMenuData();
    addSwipeGuide();
});

const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
`;
document.head.appendChild(style);