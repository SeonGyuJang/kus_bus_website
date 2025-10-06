from flask import Flask, render_template, send_from_directory, jsonify, request
import os
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, time
from crawling import crawl_and_save_menu
import json
import logging
from logging.handlers import RotatingFileHandler

app = Flask(__name__)

# 전역 변수로 메뉴 데이터와 크롤링 상태 관리
menu_data = None
last_crawl_time = None
is_crawling = False
scheduler = BackgroundScheduler()  # scheduler를 전역 변수로 이동

# 로깅 설정
def setup_logging():
    log_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logs')
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
    
    log_file = os.path.join(log_dir, 'crawler.log')
    handler = RotatingFileHandler(log_file, maxBytes=10000000, backupCount=5, encoding='utf-8')
    handler.setFormatter(logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s'
    ))
    
    logger = logging.getLogger('crawler')
    logger.setLevel(logging.INFO)
    logger.addHandler(handler)
    return logger

logger = setup_logging()

def is_menu_valid():
    """현재 날짜가 메뉴 데이터에 포함되어 있는지 확인"""
    if not menu_data or not menu_data.get('success'):
        return False
        
    try:
        today = datetime.now().strftime("%m.%d")  # 현재 날짜
        
        # 기간 정보 확인
        period_start = menu_data['data']['기간']['시작일']
        period_end = menu_data['data']['기간']['종료일']
        
        # 날짜 형식 변환 (예: "03.19" -> datetime)
        today_date = datetime.strptime(today, "%m.%d")
        start_date = datetime.strptime(period_start, "%m.%d")
        end_date = datetime.strptime(period_end, "%m.%d")
        
        # 현재 날짜가 기간 내에 있는지 확인
        if start_date <= today_date <= end_date:
            return True
        return False
    except:
        return False

def load_current_menu():
    """현재 저장된 메뉴 데이터 로드"""
    global menu_data
    menu_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'menu_data')
    
    if not os.path.exists(menu_dir):
        os.makedirs(menu_dir)
        
    student_file = os.path.join(menu_dir, 'student_menu.json')
    staff_file = os.path.join(menu_dir, 'staff_menu.json')
    
    try:
        if os.path.exists(student_file) and os.path.exists(staff_file):
            with open(student_file, 'r', encoding='utf-8') as f:
                student_data = json.load(f)
            with open(staff_file, 'r', encoding='utf-8') as f:
                staff_data = json.load(f)
                
            combined_data = {
                "기간": student_data["기간"],
                "학생식당": student_data,
                "교직원식당": staff_data
            }
            
            menu_data = {'success': True, 'data': combined_data}
            
            # 메뉴가 유효하지 않으면 크롤링 수행
            if not is_menu_valid():
                logger.info("저장된 메뉴가 오래됨, 새로운 크롤링 시작")
                perform_crawling()
                return False
                
            logger.info("메뉴 데이터 로드 성공")
            return True
    except Exception as e:
        logger.error(f"메뉴 데이터 로드 중 오류 발생: {e}")
        print(f"메뉴 데이터 로드 중 오류 발생: {e}")
    return False

def perform_crawling():
    """크롤링 수행 및 결과 저장"""
    global menu_data, last_crawl_time, is_crawling
    
    if is_crawling:
        logger.info("이미 크롤링이 진행 중입니다.")
        return
        
    try:
        is_crawling = True
        logger.info("크롤링 시작")
        crawled_data = crawl_and_save_menu()
        
        if crawled_data:
            menu_data = {'success': True, 'data': crawled_data}
            last_crawl_time = datetime.now()
            logger.info(f"크롤링 성공: {last_crawl_time}")
        else:
            menu_data = {'success': False, 'message': '식단표를 불러오는데 실패했습니다.'}
            logger.warning("크롤링 실패: 데이터를 가져오지 못했습니다.")
            
    except Exception as e:
        menu_data = {'success': False, 'message': str(e)}
        logger.error(f"크롤링 중 오류 발생: {str(e)}")
    finally:
        is_crawling = False

def retry_crawl():
    """메뉴가 없거나 현재 날짜의 메뉴가 없을 경우 크롤링 재시도"""
    if not is_menu_valid():
        logger.info("유효한 메뉴 없음, 크롤링 재시도")
        perform_crawling()

def init_scheduler():
    # 매주 월요일 05:00-07:00 사이 30분마다 실행
    scheduler.add_job(
        perform_crawling,
        trigger='cron',
        day_of_week='mon',
        hour='5-6',
        minute='0,30',
        id='initial_crawl'
    )
    logger.info("초기 크롤링 스케줄러 설정 완료 (월요일 5-6시, 30분 간격)")
    
    # 매주 월요일 07:00 이후 1시간 간격으로 재시도
    scheduler.add_job(
        retry_crawl,
        trigger='cron',
        day_of_week='mon',
        hour='7-23',
        minute=0,
        id='retry_crawl'
    )
    logger.info("재시도 크롤링 스케줄러 설정 완료 (월요일 7-23시, 1시간 간격)")
    
    scheduler.start()
    logger.info("스케줄러 시작됨")

@app.route('/')
def main():
    return render_template('main.html')

@app.route('/full-schedule')
def full_schedule():
    return render_template('full_schedule.html')

@app.route('/schedules/<path:filename>')
def serve_schedule(filename):
    return send_from_directory('schedules', filename)

@app.route('/contact')
def contact():
    return render_template('contact.html')

@app.route('/menu')
def menu():
    global menu_data
    try:
        # 메뉴 데이터가 없으면 현재 저장된 데이터 로드 시도
        if menu_data is None:
            if not load_current_menu():
                # 로드 실패시 크롤링 시도
                perform_crawling()
        
        # Accept 헤더를 확인하여 JSON 요청인지 확인
        if request.headers.get('Accept') == 'application/json':
            if menu_data is None or not menu_data.get('success', False):
                return jsonify({'success': False, 'message': '식단표를 불러오는데 실패했습니다.'})
            return jsonify({'success': True, 'data': menu_data['data']})
        
        # HTML 요청의 경우
        if menu_data is None or not menu_data.get('success', False):
            return render_template('menu.html', message='식단표를 불러오는데 실패했습니다. 잠시 후 다시 시도해주세요.')
        
        return render_template('menu.html', menu_data=menu_data['data'])
        
    except Exception as e:
        logger.error(f"메뉴 페이지 렌더링 중 오류 발생: {e}")
        if request.headers.get('Accept') == 'application/json':
            return jsonify({'success': False, 'message': str(e)})
        return render_template('menu.html', message='오류가 발생했습니다. 잠시 후 다시 시도해주세요.')

@app.route('/api/menu-status')
def menu_status():
    return jsonify({
        'has_menu': menu_data is not None and menu_data.get('success', False),
        'last_update': last_crawl_time.isoformat() if last_crawl_time else None,
        'is_crawling': is_crawling
    })

@app.route('/api/menu')
def get_menu():
    """메뉴 데이터를 JSON으로 반환하는 API 엔드포인트"""
    if menu_data is None or not menu_data.get('success', False):
        return jsonify({'success': False, 'message': '메뉴 데이터가 없습니다.'})
    return jsonify({'success': True, 'data': menu_data['data']})

@app.route('/api/scheduler-status')
def get_scheduler_status():
    """스케줄러 상태를 확인하는 API 엔드포인트"""
    jobs = scheduler.get_jobs()
    job_list = [{
        'id': job.id,
        'next_run_time': job.next_run_time.isoformat() if job.next_run_time else None,
        'trigger': str(job.trigger)
    } for job in jobs]
    
    return jsonify({
        'is_running': scheduler.running,
        'jobs': job_list
    })

@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response

if __name__ == '__main__':
    logger.info("서버 시작")
    load_current_menu()
    init_scheduler()
    app.run(debug=True, port=8080)