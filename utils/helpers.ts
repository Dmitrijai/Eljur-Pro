import DOMPurify from 'dompurify';
import { Lesson, ScheduleSettings, Message, Announcement, AppState, User, School, GradingSystemSettings, GradeType, SubjectRequirement, Grade, FinalGradeEntry, ScheduleDay, TeacherAssignment, StudentGroup, Homework, COEFFICIENT_TYPES } from '../types';

// --- TRANSLATION DICTIONARY ---
export const DICT: Record<string, Record<string, string>> = {
  ru: {
    reply: 'Ответить',
    original_message: 'Исходное сообщение',
    schedule: 'Расписание',
    homework: 'Домашние задания',
    journal: 'Журнал',
    messages: 'Сообщения',
    announcements: 'Объявления',
    users: 'Пользователи',
    rating: 'Рейтинг',
    settings: 'Настройки',
    exit: 'Выйти',
    confirm_exit_title: 'Выход из системы',
    confirm_exit_msg: 'Вы действительно хотите выйти из своей учетной записи?',
    confirm_exit_btn: 'Выйти',
    new_badge: 'Новое',
    read_status: 'Статус прочтения',
    read_by: 'Прочитано',
    unread_by: 'Не прочитано',
    all_read: 'Все прочитали',
    viewed_by_count: 'Просмотрели',
    read_receipt_title: 'Кто прочитал сообщение',
    read_receipt_announce_title: 'Кто просмотрел объявление',
    login_title: 'Вход в систему',
    role: 'Роль',
    login: 'Логин',
    password: 'Пароль',
    enter: 'Войти',
    test_data: 'Тест данные',
    director: 'Директор',
    teacher: 'Учитель',
    student: 'Ученик',
    employee: 'Сотрудник',
    creator: 'Создатель',
    developer: 'Разработчик',
    creator_panel: 'Панель Создателя',
    info_eljur: 'Инфо ЭлЖур',
    current_week: 'Текущая неделя',
    print: 'Печать',
    add: 'Добавить',
    save: 'Сохранить',
    cancel: 'Отменить',
    delete: 'Удалить',
    edit: 'Редактировать',
    subject: 'Предмет',
    class: 'Класс',
    date: 'Дата',
    theme: 'Тема',
    text: 'Текст',
    files: 'Файлы',
    attach: 'Прикрепить файлы',
    send: 'Отправить',
    inbox: 'Входящие',
    sent: 'Отправленные',
    write: 'Написать',
    to: 'Кому',
    to_label: 'Кому (Поиск / Группы)',
    from: 'От',
    fill_fields: 'Заполните все поля',
    fill_topic_text: 'Заполните тему и текст',
    select_recipient_alert: 'Выберите получателя',
    delete_msg_confirm: 'Удалить сообщение?',
    confirm_delete: 'Удалить?',
    saved: 'Сохранено',
    yes: 'Да',
    no: 'Нет',
    language: 'Язык',
    theme_appearance: 'Внешний вид',
    backup: 'Резервное копирование',
    export: 'Экспорт данных',
    import: 'Импорт данных',
    general: 'Общие настройки',
    school_name: 'Название школы',
    timezone: 'Часовой пояс',
    fonts: 'Управление шрифтами',
    highlight_class: 'Подсветить класс',
    no_lessons: 'На этой неделе у вас нет уроков',
    submit_hw: 'Дата сдачи',
    hw_text: 'Текст задания',
    save_hw: 'Сохранить ДЗ',
    history: 'История',
    grade_details: 'Детали оценки',
    comment: 'Комментарий',
    final_attestation: 'Итоговая аттестация',
    quarter: 'Четверть',
    add_date: 'Добавить дату',
    auto_calc: 'Авто-расчет',
    year: 'Год',
    exam: 'Экзамен',
    average: 'Среднее',
    lesson_order: 'Урок по счету',
    cant_hw_past: 'Нельзя задавать ДЗ на прошедшие дни!',
    cant_grade_future: 'Нельзя ставить оценки на будущее!',
    no_lesson_grade: 'Нет урока — нет оценки!',
    analytics: 'Аналитика',
    manage_schools: 'Управление школами',
    global_users: 'Глобальные пользователи',
    loading: 'Загрузка системы...',
    error_state: 'Ошибка состояния приложения',
    all_classes: 'Все классы',
    select_class: 'Выберите класс',
    week: 'Неделя',
    holidays: 'Каникулы',
    weekend: 'Выходной',
    setup_schedule: 'Настройка расписания',
    add_days: 'Добавить дни',
    manage_subjects: 'Управление предметами',
    teacher_load: 'Нагрузка',
    groups: 'Группы',
    sync_all: 'Синхронизировать ВСЕХ с расписанием',
    items: 'предметов',
    teachers_subjects: 'Предметы учителя',
    sync: 'Синхронизировать',
    add_subject: 'Добавить предмет',
    group_separation: 'Разделение на группы',
    generate: 'Сгенерировать',
    group_count: 'Кол-во групп',
    students_count: 'учеников',
    generated_groups: 'Группы не созданы. Нажмите "Сгенерировать" выше.',
    add_next_lesson: 'Добавить следующий урок',
    day_batch: 'Количество добавляемых дней за раз',
    skip_days: 'Пропускать дни (не добавлять)',
    quarter_dates: 'Даты четвертей (Для авто-расчета оценок)',
    vacation_holidays: 'Выходные и Каникулы',
    holiday_days: 'Праздничные дни (По дням)',
    holiday_title: 'Название праздника',
    add_holiday: 'Добавить праздник',
    vacation_periods: 'Каникулы (периоды)',
    date_from: 'С даты',
    date_to: 'По дату',
    add_period: 'Добавить период',
    rating_students: 'Рейтинг учеников',
    all_schools: 'Все школы',
    profile_all: 'Профиль (Все предметы)',
    ready: 'Готово',
    place: 'Место',
    school: 'Школа',
    no_rating_data: 'Нет данных для рейтинга',
    
    
    all_roles: 'Все роли',
    sort_manual: 'Сорт: Вручную',
    sort_role: 'Сорт: Роль',
    class_management: 'Управление классами',
    number: 'Номер',
    letter: 'Буква',
    add_class: 'Добавить класс',
    add_user: 'Добавить пользователя',
    user_position: 'Должность',
    assign_classes: 'Назначить классы',
    block_user: 'Блокировка пользователя',
    block_duration: 'Выберите длительность блокировки.',
    forever: 'Навсегда',
    unlock: 'Разблокировать',
    confirm_sync_title: 'Подтверждение синхронизации',
    sync_all_teachers: 'Синхронизация всех учителей',
    sync_single_teacher: 'Синхронизация учителя',
    scan_msg: 'Будет просканировано расписание и найдено',
    confirm_copy_empty: 'Нечего копировать или расписание уже существует.',
    confirm_copy_no_prev: 'На прошлой неделе нет расписания для этого класса.',
    confirm_merge_groups: 'Объединить группы? Данные подгрупп будут утеряны.',
    schedule_for: 'Расписание: ',
    past_day: 'Прошедший день',
    subgroup_label: 'Группа',
    add_label: 'Добавить надпись',
    room_placeholder: 'Каб',
    holiday_text: 'Выходной',
    delete_school_confirm: 'ВНИМАНИЕ! Вы собираетесь удалить школу',
    director_taken: 'Один директор не может управлять несколькими школами.',
    school_placeholder: 'Школа №X',
    fill_range_grades: 'Заполните диапазон оценок.',
    grades_gt_0: 'Оценки должны быть больше 0.',
    grades_min_max: 'Мин. оценка должна быть меньше макс. оценки.',
    fill_range_weights: 'Заполните диапазон весов.',
    weights_gt_0: 'Веса должны быть больше 0.',
    weights_min_max: 'Мин. вес не может быть больше макс. веса.',
    system_updated_grades_deleted: 'Система оценивания обновлена. Все старые оценки удалены.',
    confirm_delete_type: 'Вы уверены, что хотите удалить этот тип оценки?',
    enter_type_name: 'Введите название типа',
    type_exists: 'Тип с таким именем уже существует',
    cant_both_flags: 'Нельзя выбрать оба флага одновременно',
    enter_number_coeff: 'Введите число для коэффициента',
    coeff_gt_0: 'Коэффициент должен быть больше 0',
    coeff_range: 'Коэффициент должен быть в диапазоне от ',
    must_be_gt_0: 'Должно быть > 0',
    range_text: 'Диапазон: ',
    warning_dangerous: 'Внимание! Это опасное действие.',
    are_you_sure: 'Вы абсолютно уверены?',
    delete_all_grades_warning: 'Сохранение новой системы оценивания приведет к УДАЛЕНИЮ ВСЕХ ранее выставленных оценок во всей школе. Это действие необратимо.',
    all_grades_destroyed: 'Все данные об успеваемости будут уничтожены. Подтвердите сохранение.',
    i_understand_continue: 'Я понимаю, продолжить',
    confirm_delete_and_save: 'ПОДТВЕРДИТЬ УДАЛЕНИЕ И СОХРАНИТЬ',
    edit_type: 'Редактировать тип',
    add_type: 'Добавить тип',
    name_label: 'Название',
    example_essay: 'Например: Эссе',
    coefficient_label: 'Коэффициент',
    out_of_range: 'Вне диапазона',
    number_placeholder: 'Число',
    teacher_sets_weight: 'Учитель ставит вес (как Н/У)',
    no_weight_value: 'Нет веса/числа (как Н, ОП)',
    save_changes: 'Сохранить изменения',
    type_col: 'Тип',
    weight_col: 'Вес',
    actions_col: 'Действия',
    edit_short: 'Редак.',
    no_types_created: 'Нет созданных типов',
    weight_conflict_title: 'Конфликт диапазона весов',
    conflicts_found: 'Обнаружены конфликты',
    new_range_excludes: 'Новый диапазон весов исключает коэффициенты следующих типов оценок. Чтобы продолжить, эти типы будут удалены.',
    current_weight: 'Текущий вес',
    confirm_delete_continue: 'Подтвердить удаление и продолжить',
    coeff_reset_title: 'Сброс коэффициентов',
    attention: 'Внимание!',
    changed_coeff_setting: 'Вы изменили настройку использования коэффициентов. При сохранении все коэффициенты типов оценок будут сброшены до 1.',
    got_it_continue: 'Понятно, продолжить',
    replace_groups_confirm: 'Существующие группы для этого класса будут удалены. Создать новые?',
    new_text: 'Новый текст',
    error_converting_file: 'Ошибка при конвертации файла',
    add_text: 'Добавить текст',
    upload_video: 'Загрузить видео',
    eljur_info: 'Информация об ЭлЖуре',
    upload_word: 'Загрузить Word',
    upload_bg: 'Загрузить фон',
    add_media: 'Добавить медиа',
    clear_canvas: 'Очистить холст',
    delete_title: 'Удалить',
    rotation_title: 'Поворот',
    successfully_saved: 'Успешно сохранено!',
    clear_canvas_confirm: 'Вы уверены, что хотите полностью очистить холст? Это действие удалит весь текст и все элементы, и оно будет автоматически сохранено.',
    clear_and_save: 'Очистить и сохранить',
    add_video: 'Добавить видео',
    video_url: 'Ссылка на видео (YouTube, Vimeo и т.д.)',
    unsaved_grades_alert: 'У вас есть несохраненные оценки. Продолжить без сохранения?',
    leave_without_saving: 'Выйти без сохранения',
    edit_forbidden_quarter: 'Редактирование запрещено: дата вне текущей четверти.',
    not_in_any_quarter: 'Текущая дата не попадает ни в одну из четвертей. Редактирование запрещено.',
    cant_grade_outside_viewing_quarter: 'Нельзя выставлять оценки вне дат текущей просматриваемой четверти',
    quarter_suffix: ' Ч.',
    default_grade_type: 'Тип оценки по умолчанию',
    student_label: 'Ученик',
    date_label: 'Дата',
    value_label: 'Значение',
    coeff_short: 'Коэф.',
    timer_label: 'Таймер',
    comment_upper: 'КОММЕНТАРИЙ',
    no_lessons_today: 'Нет уроков',
    school_tab: 'Школа',
    classes_tab: 'Классы',
    subjects_tab: 'Предметы',
    load_tab: 'Нагрузка',
    gradings_tab: 'Настройка оценок',
    groups_tab: 'Группы',
    can_start_lesson: 'Может начать урок',
    new_items: 'новых предметов, которых нет в нагрузке.',
    no_update_needed: 'Обновление не требуется.',
    add_them: 'Добавить их?',
    confirm: 'Подтвердить',
    close: 'Закрыть',
    schools_count: 'Школы',
    total_users: 'Всего пользователей',
    directors_count: 'Директоров',
    messages_count: 'Сообщений',
    add_school: 'Добавить школу',
    director_login: 'Логин Директора',
    director_pass: 'Пароль Директора',
    create_school: 'Создать школу',
    edit_school: 'Редактирование школы',
    school_id: 'ID Школы (Осторожно!)',
    current_performance: 'Текущая успеваемость',
    
    diary: 'Дневник',
    performance: 'Успеваемость',
    lesson: 'Урок',
    time: 'Время',
    cabinet: 'Каб.',
    homework_caps: 'ДОМАШНЕЕ ЗАДАНИЕ',
    grade: 'Оценка',
    no_records: 'В этой неделе записей нет',
    no_schedule: 'На этой неделе расписания нет',
    select_lesson: 'Выберите урок',
    back: 'Назад',
    timezone_desc: 'Определяет эталонное время для школы.',
    creator_settings: 'Настройки Создателя',
    secret_key: 'Секретная клавиша (Код)',
    secret_key_desc: 'Код клавиши (например: Space, Enter, KeyA)',
    press_count: 'Количество нажатий',
    secret_pass: 'Секретный пароль администратора',
    hold_eye: 'Зажмите глаз, чтобы увидеть текущий пароль',
    app_theme: 'Тема оформления',
    theme_light: 'Светлая',
    theme_dark: 'Тёмная',
    load_font: 'Загрузить новый шрифт (.ttf, .woff)',
    load_font_desc: 'После загрузки выберите, куда применить шрифт в таблице ниже.',
    file_name: 'Имя файла',
    body_text: 'Осн. текст',
    headings: 'Заголовки',
    actions: 'Действия',
    standard_font: 'Стандартный (Inter)',
    select: 'Выбрать',
    system_font: 'Системный',
    font_loaded: 'Шрифт загружен.',
    delete_font_confirm: 'Удалить шрифт?',
    download_backup: 'Скачать полную резервную копию (JSON)',
    backup_desc: 'Включает базу данных, пользователей, оценки и все файлы.',
    import_warning: 'ВНИМАНИЕ: Все текущие данные будут заменены! Продолжить?',
    import_success: 'Импорт успешен. Страница будет перезагружена.',
    invalid_format: 'Неверный формат файла',
    import_error: 'Ошибка импорта',
    school_name_saved: 'Название школы сохранено',
    school_not_found: 'Ошибка: Школа не найдена для редактирования',
    send_as: 'Отправить как',
    me: 'Я',
    select_recipients: 'Выберите получателей или группы...',
    all_teachers: 'Все Учителя',
    whole_class: 'Весь класс',
    administration: 'Администрация',
    employees: 'Сотрудники',
    students: 'Ученики',
    unknown: 'Неизвестно',
    list_empty: 'Список пуст',
    editing: 'Редактирование',
    new_announcement: 'Новое объявление',
    new_message: 'Новое сообщение',
    sent_by_emp: 'Отправлено сотрудником',
    
    type_work: 'Тип работы',
    coefficient: 'Коэффициент',
    lesson_number: 'Номер урока',
    teacher_comment: 'Комментарий учителя',
    no_comment: 'Нет комментария',
    select_lesson_found: 'Выберите урок',
    subjects: 'Предметы',
    done: 'Готово',
    total: 'Всего',
    teachers: 'Учителя',
    directors: 'Директора',
    delete_day: 'Удалить день',
    delete_day_confirm: 'Удалить день?',
    add_days_hint: 'Нажмите кнопку ниже, чтобы добавить дни.',
    copy_prev_week: 'Скопировать с прошлой недели',
    empty_schedule_msg: 'Расписание пусто',
    past_edit_forbidden: 'Редактирование запрещено',
    day_of_week: 'День недели',
    class_assignment: 'Класс / Назначение',
    already_exists: 'Уже существует',
    no_assignments: 'Нет назначений',
    teacher_subjects: 'Предметы учителя',
    delete_assignment_confirm: 'Удалить назначение?',
    scan_schedule_msg: 'Сканирование...',
    add_them_q: 'Добавить?',
    group_count_label: 'Кол-во',
    students_count_suffix: 'учеников',
    groups_not_created: 'Группы не созданы',
    subject_name: 'Название',
    student_rating_title: 'Рейтинг',
    avg_score: 'Ср. балл',
    manage_classes: 'Управление классами',
    no_schools: 'Нет школ',
    days_batch: 'Дней за раз',
    holidays_vacations: 'Выходные и Каникулы',
    holidays_daily: 'Праздники',
    select_date: 'Выберите дату',
    holiday_name: 'Название',
    from_date: 'С',
    to_date: 'По',
    title: 'Название',
    current: 'Текущая',
    open: 'Открыть',
    download: 'Скачать',
    attach_files: 'Прикрепить файлы',
    attach_file: 'Прикрепить файл',
    replace_file: 'Заменить файл',
    login_system: 'Вход в систему',
    enter_login: 'Введите логин',
    enter_pass: 'Введите пароль',
    login_as_creator: 'Войти как Создатель',
    hold_eye_hint: 'Зажмите глаз, чтобы увидеть пароль',
    invalid_login: 'Неверные данные для входа',
    no_test_data: 'Нет тестовых данных для этой роли',
    days_mon: 'Понедельник',
    days_tue: 'Вторник',
    days_wed: 'Среда',
    days_thu: 'Четверг',
    days_fri: 'Пятница',
    days_sat: 'Суббота',
    days_sun: 'Воскресенье',
    // SHORT DAYS
    days_mon_short: 'Пн',
    days_tue_short: 'Вт',
    days_wed_short: 'Ср',
    days_thu_short: 'Чт',
    days_fri_short: 'Пт',
    days_sat_short: 'Сб',
    days_sun_short: 'Вс',
    
    example_holiday: 'Например: День знаний',
    example_vacation: 'Каникулы',
    profile_phys_math: 'Физико-математический',
    profile_inf_tech: 'Информационно-технологический',
    profile_soc_econ: 'Социально-экономический',
    profile_soc_hum: 'Социально-гуманитарный',
    profile_legal: 'Юридический',
    profile_ling: 'Лингвистический',
    profile_chem_bio: 'Химико-биологический',
    footer_text: 'ЭлЖур',
    select_recipients_placeholder: 'Выберите получателей или группы...',
    executed_by: 'исп.',
    other: 'ДРУГОЕ',
    search_placeholder: 'Поиск...',
    nothing_found: 'Ничего не найдено',
    no_options: 'Нет доступных опций',
    skipped_label: '(Пропуск)',
    seasonal_animations: 'Сезонные анимации',
    enable_seasonal: 'Включить сезонные эффекты',
    copy_schedule_title: 'Копирование расписания (с прошлой недели)',
    copy_schedule_short: 'Копирование расписания',
    copy_schedule_body: 'Выберите классы, для которых нужно скопировать расписание с прошлой недели на текущую.',
    select_all: 'Выбрать все',
    reset: 'Сбросить',
    copy: 'Скопировать',
    copy_from_prev_q: 'Скопировать с прошлой недели?',
    copy_warning_msg: 'Расписание для класса %s будет скопировано. Если дни на этой неделе уже существуют, они не будут перезаписаны.',
    pcs: 'шт.',
    time_machine_title: 'Машина времени (Системное время)',
    time_hms: 'Время (ЧЧ:ММ:СС)',
    apply: 'Применить',
    time_machine_desc: 'Изменяет "сегодня" для всего сайта (расписание, валидация оценок, сезонные эффекты).',
    invalid_time_format: 'Неверный формат времени (ЧЧ:ММ:СС)',
    time_changed: 'Время системы изменено!',
    time_reset: 'Время сброшено на реальное.',
    incorrect_date_time: 'Некорректная дата или время',
    add_label_title: 'Добавить надпись',
    add_label_desc: 'Введите текст надписи (например: "Замена", "В актовом зале" и т.д.). Надпись появится красным цветом под именем учителя.',
    label_text: 'ТЕКСТ НАДПИСИ',
    label_placeholder: 'Например: Замена',
    // New Translations
    grp: 'Гр.',
    day_settings: 'Настройки дня',
    use_groups: 'Использовать группы',
    split_lessons: 'Разделить уроки:',
    no_groups_class: 'В классе нет групп',
    weight: 'Вес (Коэф.)',
    value: 'Значение',
    type: 'Тип',
    calc_grade: 'Расчет',
    confirm_grade: 'Подтвердить',
    substitution_confirm: 'Разрешить этому учителю выставлять оценки ученикам?',
    access_granted: 'Доступ к журналу предоставлен.',
    access_denied: 'Доступ к журналу не предоставлен.',
    confirm_remove_class_load: 'Этот класс есть у учителя в нагрузке. При удалении он будет удален и из нагрузки. Продолжить?',
    nu_deadline: 'Дата превращения Н/У в 2',
    set_deadline: 'Установить таймер',
    deadline_info: 'Если не выбрана, оценка превратится в 2 через неделю.',
    nu_weight_desc: 'Коэффициент (вес) для двойки, в которую превратится Н/У',
    // Grading Setup Translations
    grading_system: 'Система оценивания',
    grade_range: 'Диапазон оценок',
    weight_range: 'Диапазон весов',
    use_coefficients: 'Использовать коэффициенты (вес)',
    grades_per_subject: 'Количество оценок по предметам',
    auto_logic_info: 'Авто (1-3 урока → 3 оценки, >3 урока → 5 оценок). Если оценок меньше минимума, выставляется Н/А (считается как 2). Учитель должен подтвердить.',
    lessons_week: 'Уроков/нед',
    min_grades: 'Мин. оценок',
    auto: 'Авто',
    manual: 'Вручную',
    not_selected: 'Не выбрано',
    search_fio: 'Поиск по ФИО...',
    sort_fio: 'Сорт: ФИО',
    no_classes: 'Нет классов',
    fio: 'ФИО',
    choose_class: 'Выберите класс',
    select_classes_placeholder: 'Выберите классы...',
    select_classes: 'Выберите хотя бы один класс',
    block_user_title: 'Блокировка пользователя',
    select_block_duration: 'Выберите длительность блокировки.',
    for_1_hour: 'На 1 час',
    for_24_hours: 'На 24 часа',
    login_taken: 'Логин уже занят',
    password_used: 'Пароль уже используется',
    can_write_to: 'Может писать в',
    access_tabs: 'Доступ к вкладкам',
    special_rights: 'Особые права',
    write_as_director: 'Писать от имени директора',
    add_to_admin: 'Включить в состав администрации',
    grading_setup: 'Настройка оценок',
    blocked: 'Заблокирован',
    account_blocked: 'Аккаунт заблокирован до',
    reset_data: 'Сбросить данные',
    reset_data_title: 'Сброс данных',
    reset_data_desc: 'Внимание! Это действие удалит все данные (оценки, расписание, пользователей), кроме тестовых данных по умолчанию.',
    reset_data_confirm: 'Вы уверены, что хотите сбросить все данные до значений по умолчанию? Это действие необратимо.',
    data_reset_success: 'Данные успешно сброшены.',
    stay: 'Остаться',
    leave_tab: 'Покинуть вкладку',
    unsaved_canvas_changes: 'У вас есть несохраненные изменения на холсте. Вы уверены, что хотите уйти? Все несохраненные данные будут потеряны.',
    unsaved_changes: 'Несохраненные изменения',
    school_users: 'Пользователи школы',
    global_list: 'Глобальный список',
    director_fio: 'ФИО Директора',
    class_teacher: 'Классный руководитель',
    class_teachers: 'Классные руководители',
    all_class_teachers: 'Все классные руководители',
    class_leadership: 'Классное руководство',
    homeroom_tab: 'Клас. рук.',
    my_class: 'Мой класс',
    not_assigned: 'Не назначен',
    max_2_classes_reached: 'Лимит: 2 класса',
    class_performance: 'Сводная ведомость успеваемости',
    homeroom_grades: 'Оценки класса',
    student_grades_overview: 'Успеваемость учеников',
    all_quarters: 'Все четверти',
    final_grades: 'Итоговые оценки',
    whole_class_summary: 'Сводка по классу',
    cant_assign_hw_holiday_vacation: 'Нельзя задавать домашнее задание на праздничный день или период каникул.',
    weight_coeff: 'Вес (Коэф.):',
    no_lessons_subject_quarter: 'В расписании этого класса нет уроков по данному предмету в текущей четверти.',
    school_admin: 'Администрация школы',
    unassigned_subgroup: 'Не распределен в подгруппу',
    no_available_tabs: 'Нет доступных вкладок. Обратитесь к директору.',
    classes_limit_hint: 'Добавление классов и назначение классных руководителей (максимум 2 класса на одного человека)',
    classes_count_suffix: 'классов',
    homeroom_short: 'кл. рук.',
    of_total: 'из',
    all_filter: 'Все',
    file_not_found: 'Файл не найден',
    download_error: 'Ошибка скачивания',
    open_error: 'Ошибка открытия',
    enter_creator_pass: 'Введите пароль Создателя',
    deadline_expired_msg: 'Срок сдачи истек',
    deadline_until_msg: 'Срок сдачи/исправления: до',
    edit_forbidden_out_of_q: 'Редактирование запрещено: дата вне текущей четверти.',
    date_not_in_any_q: 'Текущая дата не попадает ни в одну из четвертей. Редактирование запрещено.',
    cant_grade_out_of_view_q: 'Нельзя выставлять оценки вне дат текущей просматриваемой четверти',
    unsaved_grades_confirm: 'У вас есть несохраненные оценки. Продолжить без сохранения?',
    timer_btn: 'Таймер',
    autumn_vacation: 'Осенние каникулы',
    winter_vacation: 'Зимние каникулы',
    spring_vacation: 'Весенние каникулы',
    summer_vacation: 'Летние каникулы',
    director_id_exists: 'Директор с таким ID уже существует в системе',
    room_busy_in: 'Кабинет занят в',
    busy_short: 'Занят',
    in_class_short: 'в',
    min_lt_max: 'Минимальная оценка должна быть меньше максимальной',
    min_weight_gt_max: 'Минимальный коэффициент не может быть больше максимального',
    grading_updated_msg: 'Система оценивания обновлена (старые оценки удалены)',
    delete_type_confirm: 'Вы уверены, что хотите удалить этот тип оценки?',
    both_flags_error: 'Нельзя выбрать оба свойства одновременно (выберите либо «Не имеет веса», либо «Динамический вес»).',
    enter_coeff_number: 'Пожалуйста, введите числовое значение для коэффициента',
    coeff_range_error: 'Коэффициент должен быть в пределах от',
    range_label: 'Диапазон',
    wipe_grades_warning: 'Изменение шкалы оценивания приведет к полному удалению всех ранее выставленных оценок и итоговых аттестаций в школе!',
    wipe_grades_confirm: 'Вы уверены, что хотите продолжить? Все текущие и итоговые оценки школы будут безвозвратно стерты.',
    understand_continue: 'Я понимаю, продолжить',
    confirm_delete_save: 'Подтвердить удаление и сохранить',
    num_gt_0: 'Введите корректное число больше 0',
    to_continue_delete: 'Для продолжения подтвердите удаление оценок.',
    coeff_reset_to_1: 'Коэффициенты существующих типов оценок были сброшены до 1 из-за изменения допустимого диапазона.',
    holiday: 'Выходной',
    q_short: 'Ч.',
    my_schedule: 'Моё расписание',
    educational_resource: 'Образовательный ресурс',
    educational_resource_url: 'Ссылка на образовательный ресурс (курсы и др.)',
    educational_resource_placeholder: 'https://...',
    educational_resource_saved: 'Ссылка на образовательный ресурс сохранена',
    educational_resource_empty: 'Здесь ещё ничего нет',
    role_director: 'Директор',
    role_teacher: 'Учитель',
    role_student: 'Ученик',
    role_employee: 'Сотрудник',
    role_creator: 'Создатель',
  },
  en: {
    reply: 'Reply',
    original_message: 'Original message',
    schedule: 'Schedule',
    homework: 'Homework',
    journal: 'Gradebook',
    messages: 'Messages',
    announcements: 'Announcements',
    users: 'Users',
    rating: 'Rating',
    settings: 'Settings',
    exit: 'Logout',
    confirm_exit_title: 'Confirm Logout',
    confirm_exit_msg: 'Are you sure you want to log out of your account?',
    confirm_exit_btn: 'Log out',
    new_badge: 'New',
    read_status: 'Read Status',
    read_by: 'Read',
    unread_by: 'Unread',
    all_read: 'Read by all',
    viewed_by_count: 'Viewed by',
    read_receipt_title: 'Who read this message',
    read_receipt_announce_title: 'Who viewed this announcement',
    login_title: 'System Login',
    role: 'Role',
    login: 'Login',
    password: 'Password',
    enter: 'Enter',
    test_data: 'Test Data',
    director: 'Director',
    teacher: 'Teacher',
    student: 'Student',
    employee: 'Employee',
    creator: 'Creator',
    developer: 'Developer',
    creator_panel: 'Creator Panel',
    info_eljur: 'Eljur Info',
    current_week: 'Current Week',
    print: 'Print',
    add: 'Add',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    subject: 'Subject',
    class: 'Class',
    date: 'Date',
    theme: 'Subject',
    text: 'Text',
    files: 'Files',
    attach: 'Attach files',
    send: 'Send',
    inbox: 'Inbox',
    sent: 'Sent',
    write: 'Compose',
    to: 'To',
    to_label: 'To (Search / Groups)',
    from: 'From',
    fill_fields: 'Fill all fields',
    fill_topic_text: 'Subject and text required',
    select_recipient_alert: 'Select recipient',
    delete_msg_confirm: 'Delete message?',
    confirm_delete: 'Delete?',
    saved: 'Saved',
    yes: 'Yes',
    no: 'No',
    language: 'Language',
    theme_appearance: 'Appearance',
    backup: 'Backup',
    export: 'Export Data',
    import: 'Import Data',
    general: 'General Settings',
    school_name: 'School Name',
    timezone: 'Timezone',
    fonts: 'Font Management',
    highlight_class: 'Highlight Class',
    no_lessons: 'No lessons this week',
    submit_hw: 'Due Date',
    hw_text: 'Assignment Text',
    save_hw: 'Save Homework',
    history: 'History',
    grade_details: 'Grade Details',
    comment: 'Comment',
    final_attestation: 'Final Grading',
    quarter: 'Quarter',
    add_date: 'Add Date',
    auto_calc: 'Auto-Calc',
    year: 'Year',
    exam: 'Exam',
    average: 'Average',
    lesson_order: 'Lesson Order',
    cant_hw_past: 'Cannot assign homework for past dates!',
    cant_grade_future: 'Cannot grade future dates!',
    no_lesson_grade: 'No lesson — no grade!',
    analytics: 'Analytics',
    manage_schools: 'Manage Schools',
    global_users: 'Global Users',
    loading: 'System loading...',
    error_state: 'App state error',
    all_classes: 'All Classes',
    select_class: 'Select Class',
    week: 'Week',
    holidays: 'Vacation',
    weekend: 'Holiday',
    setup_schedule: 'Schedule Setup',
    add_days: 'Add Days',
    manage_subjects: 'Manage Subjects',
    teacher_load: 'Load',
    groups: 'Groups',
    sync_all: 'Sync ALL with Schedule',
    items: 'items',
    teachers_subjects: 'Teacher Subjects',
    sync: 'Sync',
    add_subject: 'Add Subject',
    group_separation: 'Group Separation',
    generate: 'Generate',
    group_count: 'Group Count',
    students_count: 'students',
    generated_groups: 'Groups not created. Click "Generate" above.',
    add_next_lesson: 'Add Next Lesson',
    day_batch: 'Days to add per batch',
    skip_days: 'Skip days (do not add)',
    quarter_dates: 'Quarter Dates (For Auto-Calc)',
    vacation_holidays: 'Weekends & Holidays',
    holiday_days: 'Holidays (By Day)',
    holiday_title: 'Holiday Name',
    add_holiday: 'Add Holiday',
    vacation_periods: 'Vacations (Periods)',
    date_from: 'From',
    date_to: 'To',
    add_period: 'Add Period',
    rating_students: 'Student Rating',
    all_schools: 'All Schools',
    profile_all: 'Profile (All Subjects)',
    ready: 'Done',
    place: 'Rank',
    school: 'School',
    no_rating_data: 'No rating data',
    
    
    all_roles: 'All Roles',
    sort_manual: 'Sort: Manual',
    sort_role: 'Sort: Role',
    class_management: 'Class Management',
    number: 'Number',
    letter: 'Letter',
    add_class: 'Add Class',
    add_user: 'Add User',
    user_position: 'Position',
    assign_classes: 'Assign Classes',
    block_user: 'Block User',
    block_duration: 'Select block duration.',
    forever: 'Forever',
    unlock: 'Unlock',
    confirm_sync_title: 'Sync Confirmation',
    sync_all_teachers: 'Sync All Teachers',
    sync_single_teacher: 'Sync Teacher',
    scan_msg: 'Schedule will be scanned and',
    confirm_copy_empty: 'Nothing to copy or schedule already exists.',
    confirm_copy_no_prev: 'No schedule for this class last week.',
    confirm_merge_groups: 'Merge groups? Subgroup data will be lost.',
    schedule_for: 'Schedule: ',
    past_day: 'Past day',
    subgroup_label: 'Group',
    add_label: 'Add label',
    room_placeholder: 'Rm',
    holiday_text: 'Holiday',
    delete_school_confirm: 'WARNING! You are about to delete school',
    director_taken: 'One director cannot manage multiple schools.',
    school_placeholder: 'School #X',
    fill_range_grades: 'Fill grade range.',
    grades_gt_0: 'Grades must be greater than 0.',
    grades_min_max: 'Min grade must be less than max grade.',
    fill_range_weights: 'Fill weight range.',
    weights_gt_0: 'Weights must be greater than 0.',
    weights_min_max: 'Min weight cannot be greater than max weight.',
    system_updated_grades_deleted: 'Grading system updated. All old grades deleted.',
    confirm_delete_type: 'Are you sure you want to delete this grade type?',
    enter_type_name: 'Enter type name',
    type_exists: 'Type with this name already exists',
    cant_both_flags: 'Cannot select both flags simultaneously',
    enter_number_coeff: 'Enter number for coefficient',
    coeff_gt_0: 'Coefficient must be greater than 0',
    coeff_range: 'Coefficient must be in range from ',
    must_be_gt_0: 'Must be > 0',
    range_text: 'Range: ',
    warning_dangerous: 'Warning! This is a dangerous action.',
    are_you_sure: 'Are you absolutely sure?',
    delete_all_grades_warning: 'Saving the new grading system will DELETE ALL previously set grades throughout the school. This is irreversible.',
    all_grades_destroyed: 'All academic data will be destroyed. Confirm save.',
    i_understand_continue: 'I understand, continue',
    confirm_delete_and_save: 'CONFIRM DELETE AND SAVE',
    edit_type: 'Edit type',
    add_type: 'Add type',
    name_label: 'Name',
    example_essay: 'Example: Essay',
    coefficient_label: 'Coefficient',
    out_of_range: 'Out of range',
    number_placeholder: 'Number',
    teacher_sets_weight: 'Teacher sets weight (like N/U)',
    no_weight_value: 'No weight/number (like N, Pass)',
    save_changes: 'Save changes',
    type_col: 'Type',
    weight_col: 'Weight',
    actions_col: 'Actions',
    edit_short: 'Edit',
    no_types_created: 'No types created',
    weight_conflict_title: 'Weight range conflict',
    conflicts_found: 'Conflicts found',
    new_range_excludes: 'The new weight range excludes the coefficients of the following grade types. To continue, these types will be deleted.',
    current_weight: 'Current weight',
    confirm_delete_continue: 'Confirm delete and continue',
    coeff_reset_title: 'Coefficient reset',
    attention: 'Attention!',
    changed_coeff_setting: 'You have changed the use coefficients setting. Upon saving, all grade type coefficients will be reset to 1.',
    got_it_continue: 'Got it, continue',
    replace_groups_confirm: 'Existing groups for this class will be deleted. Create new?',
    new_text: 'New text',
    error_converting_file: 'Error converting file',
    add_text: 'Add text',
    upload_video: 'Upload video',
    eljur_info: 'Eljur Info',
    upload_word: 'Upload Word',
    upload_bg: 'Upload Background',
    add_media: 'Add Media',
    clear_canvas: 'Clear Canvas',
    delete_title: 'Delete',
    rotation_title: 'Rotation',
    successfully_saved: 'Successfully saved!',
    clear_canvas_confirm: 'Are you sure you want to completely clear the canvas? This will remove all text and elements, and will be saved automatically.',
    clear_and_save: 'Clear and Save',
    add_video: 'Add Video',
    video_url: 'Video URL (YouTube, Vimeo, etc.)',
    unsaved_grades_alert: 'You have unsaved grades. Continue without saving?',
    leave_without_saving: 'Leave without saving',
    edit_forbidden_quarter: 'Editing forbidden: date outside current quarter.',
    not_in_any_quarter: 'Current date is not in any quarter. Editing forbidden.',
    cant_grade_outside_viewing_quarter: 'Cannot grade outside the dates of the currently viewing quarter',
    quarter_suffix: ' Q.',
    default_grade_type: 'Default grade type',
    student_label: 'Student',
    date_label: 'Date',
    value_label: 'Value',
    coeff_short: 'Coeff.',
    timer_label: 'Timer',
    comment_upper: 'COMMENT',
    no_lessons_today: 'No lessons',
    school_tab: 'School',
    classes_tab: 'Classes',
    subjects_tab: 'Subjects',
    load_tab: 'Workload',
    gradings_tab: 'Grading Setup',
    groups_tab: 'Groups',
    can_start_lesson: 'Can start lesson',
    new_items: 'new items found that are not in load.',
    no_update_needed: 'No update needed.',
    add_them: 'Add them?',
    confirm: 'Confirm',
    close: 'Close',
    schools_count: 'Schools',
    total_users: 'Total Users',
    directors_count: 'Directors',
    messages_count: 'Messages',
    add_school: 'Add School',
    director_login: 'Director Login',
    director_pass: 'Director Password',
    create_school: 'Create School',
    edit_school: 'Edit School',
    school_id: 'School ID (Caution!)',
    current_performance: 'Current Performance',
    
    diary: 'Diary',
    performance: 'Performance',
    lesson: 'Lesson',
    time: 'Time',
    cabinet: 'Room',
    homework_caps: 'HOMEWORK',
    grade: 'Grade',
    no_records: 'No records this week',
    no_schedule: 'No schedule this week',
    select_lesson: 'Select Lesson',
    back: 'Back',
    timezone_desc: 'Defines the reference time for the school.',
    creator_settings: 'Creator Settings',
    secret_key: 'Secret Key (Code)',
    secret_key_desc: 'Key Code (e.g., Space, Enter, KeyA)',
    press_count: 'Press Count',
    secret_pass: 'Secret Admin Password',
    hold_eye: 'Hold eye icon to view current password',
    app_theme: 'Theme',
    theme_light: 'Light',
    theme_dark: 'Dark',
    load_font: 'Upload New Font (.ttf, .woff)',
    load_font_desc: 'After upload, apply font in the table below.',
    file_name: 'File Name',
    body_text: 'Body Text',
    headings: 'Headings',
    actions: 'Actions',
    standard_font: 'Standard (Inter)',
    select: 'Select',
    system_font: 'System',
    font_loaded: 'Font loaded.',
    delete_font_confirm: 'Delete font?',
    download_backup: 'Download Full Backup (JSON)',
    backup_desc: 'Includes database, users, grades and all files.',
    import_warning: 'WARNING: All current data will be replaced! Continue?',
    import_success: 'Import successful. Page will reload.',
    invalid_format: 'Invalid file format',
    import_error: 'Import Error',
    school_name_saved: 'School name saved',
    school_not_found: 'Error: School not found for editing',
    send_as: 'Send As',
    me: 'Me',
    select_recipients: 'Select recipients or groups...',
    all_teachers: 'All Teachers',
    whole_class: 'Whole Class',
    administration: 'Administration',
    employees: 'Employees',
    students: 'Students',
    unknown: 'Unknown',
    list_empty: 'List is empty',
    editing: 'Editing',
    new_announcement: 'New Announcement',
    new_message: 'New Message',
    sent_by_emp: 'Sent by employee',
    
    type_work: 'Work Type',
    coefficient: 'Coefficient',
    lesson_number: 'Lesson Number',
    teacher_comment: 'Teacher Comment',
    no_comment: 'No comment',
    select_lesson_found: 'Select Lesson',
    subjects: 'Subjects',
    done: 'Done',
    total: 'Total',
    teachers: 'Teachers',
    directors: 'Directors',
    delete_day: 'Delete Day',
    delete_day_confirm: 'Delete day?',
    add_days_hint: 'Click button below to add days.',
    copy_prev_week: 'Copy from last week',
    empty_schedule_msg: 'Schedule is empty',
    past_edit_forbidden: 'Editing forbidden',
    day_of_week: 'Day of Week',
    class_assignment: 'Class / Assignment',
    already_exists: 'Already exists',
    no_assignments: 'No assignments',
    teacher_subjects: 'Teacher Subjects',
    delete_assignment_confirm: 'Delete assignment?',
    scan_schedule_msg: 'Schedule scanning...',
    add_them_q: 'Add them?',
    group_count_label: 'Count',
    students_count_suffix: 'students',
    groups_not_created: 'Groups not created',
    subject_name: 'Name',
    student_rating_title: 'Rating',
    avg_score: 'Avg. Score',
    manage_classes: 'Manage Classes',
    no_schools: 'No schools',
    days_batch: 'Days per batch',
    holidays_vacations: 'Weekends & Holidays',
    holidays_daily: 'Holidays',
    select_date: 'Select Date',
    holiday_name: 'Name',
    from_date: 'From',
    to_date: 'To',
    title: 'Title',
    current: 'Current',
    open: 'Open',
    download: 'Download',
    attach_files: 'Attach Files',
    attach_file: 'Attach File',
    replace_file: 'Replace File',
    login_system: 'System Login',
    enter_login: 'Enter Login',
    enter_pass: 'Enter Password',
    login_as_creator: 'Login as Creator',
    hold_eye_hint: 'Hold eye to see password',
    invalid_login: 'Invalid login details',
    no_test_data: 'No test data for this role',
    days_mon: 'Monday',
    days_tue: 'Tuesday',
    days_wed: 'Wednesday',
    days_thu: 'Thursday',
    days_fri: 'Friday',
    days_sat: 'Saturday',
    days_sun: 'Sunday',
    // SHORT DAYS
    days_mon_short: 'Mon',
    days_tue_short: 'Tue',
    days_wed_short: 'Wed',
    days_thu_short: 'Thu',
    days_fri_short: 'Fri',
    days_sat_short: 'Sat',
    days_sun_short: 'Sun',
    
    example_holiday: 'e.g. Labor Day',
    example_vacation: 'Vacation',
    profile_phys_math: 'Physics-Math',
    profile_inf_tech: 'IT',
    profile_soc_econ: 'Social-Economic',
    profile_soc_hum: 'Social-Humanities',
    profile_legal: 'Legal',
    profile_ling: 'Linguistic',
    profile_chem_bio: 'Chemistry-Biology',
    footer_text: 'ElZhur',
    select_recipients_placeholder: 'Select recipients or groups...',
    executed_by: 'exe.',
    other: 'OTHER',
    search_placeholder: 'Search...',
    nothing_found: 'Nothing found',
    no_options: 'No options',
    skipped_label: '(Skip)',
    seasonal_animations: 'Seasonal Animations',
    enable_seasonal: 'Enable seasonal effects',
    copy_schedule_title: 'Copy Schedule (from last week)',
    copy_schedule_short: 'Copy Schedule',
    copy_schedule_body: 'Select classes to copy schedule from last week to current week.',
    select_all: 'Select All',
    reset: 'Reset',
    copy: 'Copy',
    copy_from_prev_q: 'Copy from last week?',
    copy_warning_msg: 'Schedule for class %s will be copied. Existing days in current week will not be overwritten.',
    pcs: 'pcs.',
    time_machine_title: 'Time Machine (System Time)',
    time_hms: 'Time (HH:MM:SS)',
    apply: 'Apply',
    time_machine_desc: 'Changes "today" for the entire site (schedule, grading validation, seasonal effects).',
    invalid_time_format: 'Invalid time format (HH:MM:SS)',
    time_changed: 'System time changed!',
    time_reset: 'Time reset to real time.',
    incorrect_date_time: 'Incorrect date or time',
    add_label_title: 'Add Label',
    add_label_desc: 'Enter label text (e.g. "Substitution", "In Assembly Hall", etc.). Label will appear in red under teacher name.',
    label_text: 'LABEL TEXT',
    label_placeholder: 'e.g. Substitution',
    grp: 'Grp.',
    day_settings: 'Day Settings',
    use_groups: 'Use Groups',
    split_lessons: 'Split Lessons:',
    no_groups_class: 'No groups in class',
    weight: 'Weight',
    value: 'Value',
    type: 'Type',
    calc_grade: 'Calc',
    confirm_grade: 'Confirm',
    substitution_confirm: 'Allow this teacher to grade students?',
    access_granted: 'Journal access granted.',
    access_denied: 'Journal access NOT granted.',
    confirm_remove_class_load: 'This class is in the teacher\'s load. Removing it will also remove it from the load. Continue?',
    nu_deadline: 'Deadline for N/U to become 2',
    set_deadline: 'Set Timer',
    deadline_info: 'If not selected, grade will turn into 2 in one week.',
    nu_weight_desc: 'Coefficient (weight) for the potential "2"',
    // Grading Setup Translations
    grading_system: 'Grading System',
    grade_range: 'Grade Range',
    weight_range: 'Weight Range',
    use_coefficients: 'Use coefficients (weight)',
    grades_per_subject: 'Grades per Subject',
    auto_logic_info: 'Auto (1-3 lessons → 3 grades, >3 lessons → 5 grades). If fewer grades than min, N/A is set (counts as 2). Teacher must confirm.',
    lessons_week: 'Lessons/Week',
    min_grades: 'Min. Grades',
    auto: 'Auto',
    manual: 'Manual',
    not_selected: 'Not selected',
    search_fio: 'Search by full name...',
    sort_fio: 'Sort: Full Name',
    no_classes: 'No classes',
    fio: 'Full Name',
    choose_class: 'Choose class',
    select_classes_placeholder: 'Select classes...',
    select_classes: 'Select at least one class',
    block_user_title: 'Block User',
    select_block_duration: 'Select block duration.',
    for_1_hour: 'For 1 hour',
    for_24_hours: 'For 24 hours',
    login_taken: 'Login already taken',
    password_used: 'Password already used',
    can_write_to: 'Can write to',
    access_tabs: 'Access to tabs',
    special_rights: 'Special rights',
    write_as_director: 'Write as director',
    add_to_admin: 'Add to administration',
    grading_setup: 'Grading Setup',
    blocked: 'Blocked',
    account_blocked: 'Account blocked until',
    reset_data: 'Reset Data',
    reset_data_title: 'Reset Data',
    reset_data_desc: 'Warning! This action will delete all data (grades, schedule, users), except default test data.',
    reset_data_confirm: 'Are you sure you want to reset all data to default? This action is irreversible.',
    data_reset_success: 'Data successfully reset.',
    stay: 'Stay',
    leave_tab: 'Leave Tab',
    unsaved_canvas_changes: 'You have unsaved changes on the canvas. Are you sure you want to leave? All unsaved data will be lost.',
    unsaved_changes: 'Unsaved Changes',
    school_users: 'School Users',
    global_list: 'Global List',
    director_fio: 'Director Full Name',
    class_teacher: 'Class Teacher',
    class_teachers: 'Class Teachers',
    all_class_teachers: 'All Class Teachers',
    class_leadership: 'Homeroom Class',
    homeroom_tab: 'Class Leadership',
    my_class: 'My Class',
    not_assigned: 'Not assigned',
    max_2_classes_reached: 'Limit: 2 classes',
    class_performance: 'Class Performance Sheet',
    homeroom_grades: 'Homeroom Grades',
    student_grades_overview: 'Student Performance Overview',
    all_quarters: 'All Quarters',
    final_grades: 'Final Grades',
    whole_class_summary: 'Class Summary',
    cant_assign_hw_holiday_vacation: 'Cannot assign homework on a holiday or vacation.',
    weight_coeff: 'Weight (Coeff.):',
    no_lessons_subject_quarter: 'There are no lessons for this subject in the schedule for this class in the current quarter.',
    school_admin: 'School Administration',
    unassigned_subgroup: 'Not assigned to a subgroup',
    no_available_tabs: 'No available tabs. Please contact the director.',
    classes_limit_hint: 'Add classes and assign homeroom teachers (maximum 2 classes per person)',
    classes_count_suffix: 'classes',
    homeroom_short: 'homeroom',
    of_total: 'of',
    all_filter: 'All',
    file_not_found: 'File not found',
    download_error: 'Download error',
    open_error: 'Error opening file',
    enter_creator_pass: 'Enter Creator password',
    deadline_expired_msg: 'Submission deadline expired',
    deadline_until_msg: 'Deadline for submission/correction: until',
    edit_forbidden_out_of_q: 'Editing forbidden: date is outside the current quarter.',
    date_not_in_any_q: 'Current date does not fall within any quarter. Editing is forbidden.',
    cant_grade_out_of_view_q: 'Cannot enter grades outside the dates of the currently viewed quarter',
    unsaved_grades_confirm: 'You have unsaved grades. Continue without saving?',
    timer_btn: 'Timer',
    autumn_vacation: 'Autumn Vacation',
    winter_vacation: 'Winter Vacation',
    spring_vacation: 'Spring Vacation',
    summer_vacation: 'Summer Vacation',
    director_id_exists: 'A director with this ID already exists in the system',
    room_busy_in: 'Room is occupied in',
    busy_short: 'Busy',
    in_class_short: 'in',
    min_lt_max: 'Minimum grade must be less than maximum grade',
    min_weight_gt_max: 'Minimum weight coefficient cannot be greater than maximum',
    grading_updated_msg: 'Grading system updated (previous grades cleared)',
    delete_type_confirm: 'Are you sure you want to delete this grade type?',
    both_flags_error: 'Cannot select both flags simultaneously (choose either "No weight" or "Dynamic weight").',
    enter_coeff_number: 'Please enter a numeric value for the weight coefficient',
    coeff_range_error: 'Weight coefficient must be between',
    range_label: 'Range',
    wipe_grades_warning: 'Changing the grading scale will permanently delete all previously entered grades and final attestations in the school!',
    wipe_grades_confirm: 'Are you sure you want to continue? All current and final grades in the school will be permanently erased.',
    understand_continue: 'I understand, continue',
    confirm_delete_save: 'Confirm deletion and save',
    num_gt_0: 'Enter a valid number greater than 0',
    to_continue_delete: 'Please confirm grade deletion to continue.',
    coeff_reset_to_1: 'Weight coefficients of existing grade types were reset to 1 due to the allowed range change.',
    holiday: 'Holiday',
    q_short: 'Q.',
    my_schedule: 'My Schedule',
    educational_resource: 'Educational Resource',
    educational_resource_url: 'Educational Resource Link (courses, etc.)',
    educational_resource_placeholder: 'https://...',
    educational_resource_saved: 'Educational resource link saved',
    educational_resource_empty: 'There is nothing here yet',
    role_director: 'Director',
    role_teacher: 'Teacher',
    role_student: 'Student',
    role_employee: 'Employee',
    role_creator: 'Creator',
  }
};

// --- HELPERS ---

export const t = (key: string, lang: 'ru' | 'en' = 'ru'): string => {
  return DICT[lang]?.[key] || DICT['ru']?.[key] || key;
};

export const uid = (prefix: string = 'id'): string => {
  return `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
};

export const formatShortName = (fioStr: string): string => {
  if (!fioStr) return '';
  const parts = fioStr.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} ${parts[1][0]}.`;
  return `${parts[0]} ${parts[1][0]}. ${parts[2][0]}.`;
};

export const dateToIso = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const isDateInWeek = (dateStr: string, weekStartDate: Date): boolean => {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const start = new Date(weekStartDate);
  start.setHours(0, 0, 0, 0);
  const end = addDays(start, 6);
  end.setHours(23, 59, 59, 999);
  return d >= start && d <= end;
};

export const getNextWorkingDate = (date: Date, skippedDays?: number[]): Date => {
  const safeSkipped = Array.isArray(skippedDays) && skippedDays.length < 7 ? skippedDays : [0];
  let next = addDays(date, 1);
  let guard = 0;
  while (safeSkipped.includes(next.getDay()) && guard < 14) {
    next = addDays(next, 1);
    guard++;
  }
  return next;
};

export const getDayOfWeek = (dateStr: string, lang: string): string => {
    const date = new Date(dateStr);
    const day = date.getDay(); // 0=Sun, 1=Mon
    const keys = ['days_sun', 'days_mon', 'days_tue', 'days_wed', 'days_thu', 'days_fri', 'days_sat'];
    return t(keys[day], lang as 'ru' | 'en');
};

export const generateDefaultLessons = (): Lesson[] => {
    return [
        { id: uid('l'), timeRange: '08:30 - 09:15', lesson: '', teacherId: '', room: '' },
        { id: uid('l'), timeRange: '09:25 - 10:10', lesson: '', teacherId: '', room: '' },
        { id: uid('l'), timeRange: '10:30 - 11:15', lesson: '', teacherId: '', room: '' },
        { id: uid('l'), timeRange: '11:35 - 12:20', lesson: '', teacherId: '', room: '' },
        { id: uid('l'), timeRange: '12:30 - 13:15', lesson: '', teacherId: '', room: '' },
        { id: uid('l'), timeRange: '13:25 - 14:10', lesson: '', teacherId: '', room: '' },
        { id: uid('l'), timeRange: '14:20 - 15:05', lesson: '', teacherId: '', room: '' },
    ];
};

export const calculateNextTimeRange = (prevRange: string): string => {
    const [start, end] = prevRange.split(' - ');
    if (!end) return '00:00 - 00:00';
    
    const parseTime = (s: string) => {
        const [h, m] = s.split(':').map(Number);
        return h * 60 + m;
    };
    const formatTime = (m: number) => {
        const h = Math.floor(m / 60);
        const min = m % 60;
        return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    };

    const endM = parseTime(end);
    const breakDuration = 10; // Default break
    const lessonDuration = 45; // Default lesson

    const nextStartM = endM + breakDuration;
    const nextEndM = nextStartM + lessonDuration;

    return `${formatTime(nextStartM)} - ${formatTime(nextEndM)}`;
};

export const formatDateDDMMYYYY = (dateStr: string): string => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}.${m}.${y}`;
};

export const isHoliday = (dateStr: string, settings?: ScheduleSettings): { title: string } | null => {
    const holidays = Array.isArray(settings?.holidays) ? settings!.holidays : [];
    const h = holidays.find(x => x && x.date === dateStr);
    return h ? { title: h.title } : null;
};

// AUTO-VACATION LOGIC
const getGapVacation = (dateStr: string, settings?: ScheduleSettings): { title: string } | null => {
    const qDefs = settings?.quarterDefinitions;
    if (!qDefs) return null;
    
    const d = dateStr;
    const q1End = qDefs['Q1']?.end;
    const q2Start = qDefs['Q2']?.start;
    const q2End = qDefs['Q2']?.end;
    const q3Start = qDefs['Q3']?.start;
    const q3End = qDefs['Q3']?.end;
    const q4Start = qDefs['Q4']?.start;
    const q4End = qDefs['Q4']?.end;
    
    // Autumn: Gap between Q1 and Q2
    if (q1End && q2Start && d > q1End && d < q2Start) return { title: 'Осенние каникулы' };
    
    // Winter: Gap between Q2 and Q3
    if (q2End && q3Start && d > q2End && d < q3Start) return { title: 'Зимние каникулы' };
    
    // Spring: Gap between Q3 and Q4
    if (q3End && q4Start && d > q3End && d < q4Start) return { title: 'Весенние каникулы' };
    
    // Summer: After Q4
    if (q4End && d > q4End) return { title: 'Летние каникулы' };

    return null;
};

export const getVacationForDay = (dateStr: string, settings?: ScheduleSettings): { title: string } | null => {
    // 1. Explicit vacations
    const d = new Date(dateStr);
    const vacations = Array.isArray(settings?.vacations) ? settings!.vacations : [];
    const explicit = vacations.find(vac => {
        if (!vac || !vac.start || !vac.end) return false;
        const start = new Date(vac.start);
        const end = new Date(vac.end);
        return d >= start && d <= end;
    });
    if (explicit) return { title: explicit.title };

    // 2. Auto-gap vacations
    return getGapVacation(dateStr, settings);
};

export const getVacationForWeek = (weekStart: Date, settings: ScheduleSettings | undefined, visibleDates: string[]): { isFullWeek: boolean, title: string, emoji: string, range: string } | null => {
    // Determine if the majority of the week is a vacation
    const weekEnd = addDays(weekStart, 6);
    const vacations = Array.isArray(settings?.vacations) ? settings!.vacations : [];
    
    // Check explicit vacations
    const overlappingVacation = vacations.find(v => {
        if (!v || !v.start || !v.end) return false;
        const vStart = new Date(v.start);
        const vEnd = new Date(v.end);
        return vStart <= weekEnd && vEnd >= weekStart;
    });

    if (overlappingVacation) {
        const vStart = new Date(overlappingVacation.start);
        const vEnd = new Date(overlappingVacation.end);
        const isFullWeek = vStart <= weekStart && vEnd >= weekEnd;
        return {
            isFullWeek,
            title: overlappingVacation.title,
            emoji: '🎉',
            range: `${formatDateDDMMYYYY(overlappingVacation.start)} — ${formatDateDDMMYYYY(overlappingVacation.end)}`
        };
    }
    
    // Check Auto-Gaps by checking the middle day of the week
    const midWeekDate = addDays(weekStart, 3);
    const midWeekIso = dateToIso(midWeekDate);
    const gap = getGapVacation(midWeekIso, settings);
    
    if (gap) {
        // Assume full week for gaps usually
        return {
            isFullWeek: true,
            title: gap.title,
            emoji: '🎉',
            range: gap.title // Range isn't strict for gaps
        };
    }

    return null;
};

export const getWeekRangeString = (weekStart: Date): string => {
    const weekEnd = addDays(weekStart, 6);
    const f = (d: Date) => {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        return `${dd}.${mm}`;
    };
    return `${f(weekStart)} - ${f(weekEnd)}`;
};

export const parseGradeNumericValue = (val: string | number | undefined, minGrade: number = 2): number | null => {
    if (val === undefined || val === null || val === '') return null;
    if (typeof val === 'number') return isNaN(val) ? null : val;
    const str = String(val).trim();
    if (str === '') return null;
    
    // Dual grades like "5/4", "4/5", "3/4"
    if (str.includes('/')) {
        const upper = str.toUpperCase();
        if (upper === 'Н/У' || upper === 'N/U') {
            return null;
        }
        const parts = str.split('/').map(p => parseFloat(p.trim())).filter(n => !isNaN(n));
        if (parts.length > 0) {
            const sum = parts.reduce((a, b) => a + b, 0);
            return sum / parts.length;
        }
        return null;
    }
    
    const upper = str.toUpperCase();
    if (['Н', 'N', 'УВ', 'Б', 'ОП', 'О', 'ЗЧ', 'НЗ'].includes(upper)) {
        return null;
    }
    
    const parsed = parseFloat(str);
    return isNaN(parsed) ? null : parsed;
};

export const isGradeExpiredNU = (grade: Grade | undefined | null, systemTimeOffset: number = 0): boolean => {
    if (!grade || grade.value === undefined || grade.value === null) return false;
    const valStr = String(grade.value).trim().toUpperCase();
    if (valStr !== 'Н/У' && valStr !== 'N/U') return false;
    const systemNow = new Date(Date.now() + systemTimeOffset);
    systemNow.setHours(0, 0, 0, 0);
    const created = new Date(grade.date);
    const deadline = grade.deadline ? new Date(grade.deadline) : addDays(created, 7);
    return systemNow >= deadline;
};

export const getEffectiveGradeValue = (grade: Grade | undefined | null, minGrade: number = 2, systemTimeOffset: number = 0): number | null => {
    if (!grade || grade.value === undefined || grade.value === null || grade.value === '') return null;
    const valStr = String(grade.value).trim();
    if (valStr.toUpperCase() === 'Н/У' || valStr.toUpperCase() === 'N/U') {
        if (isGradeExpiredNU(grade, systemTimeOffset)) {
            return minGrade;
        }
        return null;
    }
    return parseGradeNumericValue(valStr, minGrade);
};

export const isAttendanceMark = (val: string | number | undefined): boolean => {
    if (!val) return false;
    const upper = String(val).trim().toUpperCase();
    return ['Н', 'N', 'УВ', 'Б', 'ОП', 'О'].includes(upper);
};

export const isPassFailMark = (val: string | number | undefined): boolean => {
    if (!val) return false;
    const upper = String(val).trim().toUpperCase();
    return ['ЗЧ', 'НЗ'].includes(upper);
};

export const getGradeColorClass = (val: string, min: number = 2, max: number = 5): string => {
    if (val === 'Н/У') return 'text-red-500 font-bold'; // Special styling for N/U
    const upper = String(val).trim().toUpperCase();
    if (['Н', 'N', 'УВ', 'Б'].includes(upper)) return 'text-amber-600 dark:text-amber-400 font-bold';
    if (upper === 'ОП' || upper === 'О') return 'text-yellow-600 dark:text-yellow-400 font-bold';
    if (upper === 'ЗЧ') return 'text-emerald-600 dark:text-emerald-400 font-bold';
    if (upper === 'НЗ') return 'text-rose-600 dark:text-rose-400 font-bold';

    const num = parseGradeNumericValue(val, min);
    if (num === null || isNaN(num)) return 'text-slate-700 dark:text-slate-300';
    
    // Ensure range logic (Higher = Better)
    // Red (0) at Min, Green (120) at Max
    const safeMin = Math.min(min, max);
    const safeMax = Math.max(min, max);
    
    // Clamp
    const clamped = Math.max(safeMin, Math.min(safeMax, num));
    
    const range = safeMax - safeMin;
    const ratio = range === 0 ? (clamped >= safeMax ? 1 : 0) : (clamped - safeMin) / range;
    
    const hue = Math.round(ratio * 120);
    
    // HSL colors
    return `text-[hsl(${hue},90%,35%)] dark:text-[hsl(${hue},85%,60%)]`;
};

export const getQuarterFromDate = (dateStr: string): string => {
    // Simple logic if no settings:
    // Sep-Oct: Q1, Nov-Dec: Q2, Jan-Mar: Q3, Apr-May: Q4
    const m = parseInt(dateStr.split('-')[1]);
    if (m >= 9 && m <= 10) return 'Q1';
    if (m >= 11 && m <= 12) return 'Q2';
    if (m >= 1 && m <= 3) return 'Q3';
    if (m >= 4 && m <= 6) return 'Q4';
    return 'Q1';
};

// --- UNREAD MESSAGES & ANNOUNCEMENTS HELPERS ---

export const isMessageUnreadByUser = (m: Message, userOrId: User | string, allUsers?: User[]): boolean => {
    if (!m) return false;
    const userId = typeof userOrId === 'string' ? userOrId : userOrId.id;
    const currentUser = typeof userOrId === 'object' ? userOrId : allUsers?.find(u => u.id === userId);

    // Messages created by current user are not unread for them
    if (m.fromId === userId || m.realAuthorId === userId) return false;
    // Must be addressed to user
    if (!m.toIds || !m.toIds.includes(userId)) return false;

    // Defense-in-depth: check schoolId matching (creator messages can be cross-school or global)
    if (currentUser) {
        const sender = allUsers?.find(u => u.id === m.fromId);
        const isFromCreator = (sender && (sender.role as string) === 'creator') || m.fromId === 'u_creator' || m.schoolId === 'global';
        if (!isFromCreator) {
            if (m.schoolId && currentUser.schoolId && (currentUser.role as string) !== 'creator') {
                if (m.schoolId !== currentUser.schoolId) return false;
            } else if (!m.schoolId && sender && currentUser.schoolId && (currentUser.role as string) !== 'creator') {
                if (sender.schoolId !== currentUser.schoolId) return false;
            }
        }
    }

    // Check if user has read it
    if (m.readBy && m.readBy.includes(userId)) return false;
    return true;
};

export const isAnnouncementUnreadByUser = (a: Announcement, user: User, allUsers: User[]): boolean => {
    if (!a || !user) return false;
    // Announcements created by current user are not unread for them
    if (a.fromId === user.id || a.realAuthorId === user.id) return false;
    const sender = allUsers.find(u => u.id === a.fromId);
    if (a.schoolId) {
        if (a.schoolId !== user.schoolId) return false;
    } else if (sender) {
        if ((sender.role as string) !== 'creator' && sender.schoolId !== user.schoolId) return false;
    } else {
        return false;
    }
    // Check if user has read it
    if (a.readBy && a.readBy.includes(user.id)) return false;
    return true;
};

export const getUnreadMessagesCount = (state: AppState, user: User): number => {
    if (!state || !state.messages || !Array.isArray(state.messages) || !user) return 0;
    const users = state.users || [];
    return state.messages.filter(m => isMessageUnreadByUser(m, user, users)).length;
};

export const getUnreadAnnouncementsCount = (state: AppState, user: User): number => {
    if (!state || !state.announcements || !Array.isArray(state.announcements) || !user) return 0;
    const users = state.users || [];
    return state.announcements.filter(a => isAnnouncementUnreadByUser(a, user, users)).length;
};

// ==========================================
// --- SCHOOL ISOLATION HELPER FUNCTIONS ---
// ==========================================

export const defaultGradingSystem: GradingSystemSettings = {
    minGrade: 2,
    maxGrade: 5,
    useWeights: true,
    minWeight: 1,
    maxWeight: 10
};

export const normalizeGradeTypeKey = (rawType?: string, gradeTypes?: GradeType[]): string => {
    if (!rawType) return 'default';
    const trimmed = String(rawType).trim();
    if (!trimmed || trimmed === '...' || trimmed.toLowerCase() === 'default') return 'default';
    const upper = trimmed.toUpperCase();
    if (['SR', 'С/Р', 'СР', 'САМ', 'САМОСТОЯТЕЛЬНАЯ'].includes(upper)) return 'sr';
    if (['KP', 'KR', 'К/Р', 'КР', 'КОНТРОЛЬНАЯ'].includes(upper)) return 'kr';
    if (['WORK', 'RAB', 'РАБ', 'РАБОТА', 'РАБ. НА УРОКЕ', 'РАБОТА НА УРОКЕ'].includes(upper)) return 'otv';
    if (['ORAL', 'OTV', 'ОТВ', 'ОТВЕТ', 'УСТНЫЙ ОТВЕТ'].includes(upper)) return 'otv';
    if (['HW', 'DZ', 'Д/З', 'ДЗ', 'ДОМАШНЯЯ РАБОТА'].includes(upper)) return 'dz';
    if (['PR', 'PRACTICE', 'П/Р', 'ПР', 'ПРАКТИКА', 'ПРАКТИЧЕСКАЯ'].includes(upper)) return 'pr';
    if (['LR', 'LAB', 'Л/Р', 'ЛР', 'ЛАБ', 'ЛАБОРАТОРНАЯ'].includes(upper)) return 'lr';
    if (['DICT', 'ДИКТАНТ', 'ДИКТ'].includes(upper)) return 'dict';
    if (['TEST', 'ТЕСТ'].includes(upper)) return 'test';
    if (['ESS', 'ESSAY', 'ЭССЕ', 'СОЧИНЕНИЕ'].includes(upper)) return 'ess';
    if (['NU', 'Н/У', 'N/U'].includes(upper)) return 'nu';
    if (['N', 'Н'].includes(upper)) return 'n';
    if (['OP', 'ОП', 'ОПОЗДАНИЕ'].includes(upper)) return 'op';
    if (Array.isArray(gradeTypes) && gradeTypes.length > 0) {
        const matched = gradeTypes.find(t => t.key === trimmed || t.id === trimmed || t.name === trimmed);
        if (matched && matched.key !== 'rab' && matched.name !== 'Раб. на уроке') return matched.key;
    }
    return trimmed.toLowerCase();
};

const GRADE_TYPE_LABELS_RU: Record<string, string> = {
    otv: 'Ответ',
    dz: 'Д/З',
    rab: 'Ответ',
    pr: 'П/Р',
    sr: 'С/Р',
    lr: 'Л/Р',
    dict: 'Диктант',
    test: 'Тест',
    ess: 'Эссе',
    kr: 'К/Р',
    nu: 'Н/У',
    n: 'Н',
    op: 'ОП',
    default: '...'
};

const GRADE_TYPE_LABELS_EN: Record<string, string> = {
    otv: 'Oral',
    dz: 'HW',
    rab: 'Oral',
    pr: 'Practice',
    sr: 'Quiz',
    lr: 'Lab',
    dict: 'Dictation',
    test: 'Test',
    ess: 'Essay',
    kr: 'Test/Exam',
    nu: 'N/U',
    n: 'Abs',
    op: 'Late',
    default: '...'
};

export const getGradeTypeDisplayName = (
    rawType: string | undefined,
    gradeTypes?: GradeType[],
    lang: 'ru' | 'en' = 'ru'
): string => {
    const normKey = normalizeGradeTypeKey(rawType, gradeTypes);
    if (normKey === 'default') return '...';
    if (Array.isArray(gradeTypes) && gradeTypes.length > 0) {
        const matched = gradeTypes.find(
            t =>
                t.key === rawType ||
                t.id === rawType ||
                t.name === rawType ||
                t.key === normKey ||
                normalizeGradeTypeKey(t.key) === normKey ||
                normalizeGradeTypeKey(t.name) === normKey
        );
        if (matched && matched.name && matched.name !== '...' && !/^[A-Z_]+$/.test(matched.name)) {
            return matched.name;
        }
    }
    const dict = lang === 'en' ? GRADE_TYPE_LABELS_EN : GRADE_TYPE_LABELS_RU;
    return dict[normKey] || (rawType && !/^[A-Z_]+$/.test(rawType) ? rawType : '...');
};

export const getEffectiveGradeWeight = (
    g: Grade | undefined | null,
    gradeTypes?: GradeType[],
    useWeights: boolean = true
): number => {
    if (!g) return 1;
    const normKey = normalizeGradeTypeKey(g.type);
    if (normKey === 'n' || normKey === 'op' || isAttendanceMark(g.value)) return 0;
    if (!useWeights) return 1;

    const typeDef = Array.isArray(gradeTypes)
        ? gradeTypes.find(
              t =>
                  t.key === g.type ||
                  t.id === g.type ||
                  t.name === g.type ||
                  t.key === normKey ||
                  normalizeGradeTypeKey(t.key) === normKey
          )
        : undefined;

    if (typeDef?.isNoWeight) return 0;
    if (typeDef?.isDynamicWeight || normKey === 'nu') {
        return typeof g.weight === 'number' && g.weight > 0 ? g.weight : 1;
    }
    if (typeof g.weight === 'number' && g.weight > 0) {
        return g.weight;
    }
    if (typeDef && typeof typeDef.weight === 'number' && typeDef.weight > 0) {
        return typeDef.weight;
    }
    const fallbackDef = COEFFICIENT_TYPES.find(c => c.key === normKey);
    return fallbackDef?.weight || 1;
};

export const getDefaultGradeTypes = (): GradeType[] => [
    { id: uid('gt_def'), key: 'default', name: '...', weight: 1 },
    ...COEFFICIENT_TYPES.map(def => ({
        id: uid('gt'),
        key: def.key,
        name: def.name,
        weight: def.weight,
        isDynamicWeight: def.key === 'nu',
        isNoWeight: def.key === 'n' || def.key === 'op'
    }))
];

export const defaultScheduleSettings: ScheduleSettings = {
    daysToAddBatch: 1,
    skippedWeekDays: [0, 6],
    holidays: [],
    vacations: [],
    quarterDefinitions: {
        'Q1': { start: '2026-09-01', end: '2026-11-15' },
        'Q2': { start: '2026-11-23', end: '2026-12-30' },
        'Q3': { start: '2027-01-11', end: '2027-03-25' },
        'Q4': { start: '2027-04-01', end: '2027-05-31' }
    }
};

export const normalizeScheduleSettings = (raw?: Partial<ScheduleSettings> | any): ScheduleSettings => {
    const defaultQDefs = defaultScheduleSettings.quarterDefinitions!;
    if (!raw || typeof raw !== 'object') {
        return JSON.parse(JSON.stringify(defaultScheduleSettings));
    }
    const resolveQ = (qKey: 'Q1' | 'Q2' | 'Q3' | 'Q4') => {
        const q = raw.quarterDefinitions?.[qKey];
        if (q && typeof q.start === 'string' && q.start.trim() && typeof q.end === 'string' && q.end.trim()) {
            return { start: q.start.trim(), end: q.end.trim() };
        }
        return { ...defaultQDefs[qKey] };
    };
    return {
        ...raw,
        daysToAddBatch: typeof raw.daysToAddBatch === 'number' && raw.daysToAddBatch > 0 ? raw.daysToAddBatch : 1,
        skippedWeekDays: Array.isArray(raw.skippedWeekDays) ? raw.skippedWeekDays : [0, 6],
        holidays: Array.isArray(raw.holidays) ? raw.holidays : [],
        vacations: Array.isArray(raw.vacations) ? raw.vacations : [],
        quarterDefinitions: {
            'Q1': resolveQ('Q1'),
            'Q2': resolveQ('Q2'),
            'Q3': resolveQ('Q3'),
            'Q4': resolveQ('Q4')
        }
    };
};

export const getSchool = (state: AppState, schoolId?: string): School | undefined => {
    if (!state?.schools || state.schools.length === 0) return undefined;
    if (!schoolId || schoolId === 'global') return state.schools[0];
    return state.schools.find(s => s.id === schoolId) || (schoolId === 'school_1' ? state.schools[0] : undefined);
};

export const getSchoolGradingSystem = (state: AppState, schoolId?: string): GradingSystemSettings => {
    const school = getSchool(state, schoolId);
    const scopedRaw = schoolId ? (state as any)?.schoolGradingSystems?.[schoolId] : undefined;
    const raw: any = (school && school.gradingSystem)
        ? school.gradingSystem
        : (scopedRaw || ((!schoolId || schoolId === 'global' || schoolId === 'school_1') ? state?.gradingSystem : undefined));

    // Inspect actual grades for this school to self-heal mismatched scale metadata in Firestore
    let observedMax = 0;
    if (schoolId && schoolId !== 'global' && state?.grades) {
        const prefix = `${schoolId}__`;
        Object.entries(state.grades).forEach(([k, subjMap]) => {
            if (k.startsWith(prefix) || (schoolId === 'school_1' && !k.includes('__'))) {
                Object.values(subjMap || {}).forEach((arr: any) => {
                    if (Array.isArray(arr)) {
                        arr.forEach((g: any) => {
                            const v = parseGradeNumericValue(g?.value, 1);
                            if (v !== null && v > observedMax) observedMax = v;
                        });
                    }
                });
            }
        });
    }

    if (raw && typeof raw === 'object') {
        let isHundredScale = String(raw.scale) === '100' || Number(raw.maxGrade) === 100 || observedMax > 10;
        let isTenScale = !isHundredScale && (String(raw.scale) === '10' || Number(raw.maxGrade) === 10 || (raw.thresholds?.grade5 && Number(raw.thresholds.grade5) > 5) || observedMax > 5);
        // If a school (e.g. school_2) was mistakenly tagged as 10-point in Firestore but all its grades are <= 5, use 2-5 scale
        if (isTenScale && observedMax > 0 && observedMax <= 5 && Number(raw.maxGrade) <= 5) {
            isTenScale = false;
        }
        if (observedMax > 0 && observedMax <= 5 && schoolId === 'school_2') {
            isTenScale = false;
        }
        if (observedMax > 5 && observedMax <= 10) {
            isTenScale = true;
        }
        const fallbackMin = isTenScale || isHundredScale ? 1 : defaultGradingSystem.minGrade;
        const fallbackMax = isHundredScale ? 100 : (isTenScale ? 10 : defaultGradingSystem.maxGrade);
        return {
            minGrade: isHundredScale ? 1 : (isTenScale ? 1 : (typeof raw.minGrade === 'number' && raw.minGrade <= 5 ? raw.minGrade : fallbackMin)),
            maxGrade: isHundredScale ? 100 : (isTenScale ? 10 : (typeof raw.maxGrade === 'number' && raw.maxGrade <= 5 ? raw.maxGrade : fallbackMax)),
            useWeights: typeof raw.useWeights === 'boolean' ? raw.useWeights : defaultGradingSystem.useWeights,
            minWeight: typeof raw.minWeight === 'number' ? raw.minWeight : defaultGradingSystem.minWeight,
            maxWeight: typeof raw.maxWeight === 'number' ? raw.maxWeight : defaultGradingSystem.maxWeight
        };
    }
    if (observedMax > 10) {
        return { ...defaultGradingSystem, minGrade: 1, maxGrade: 100 };
    }
    if (observedMax > 5) {
        return { ...defaultGradingSystem, minGrade: 1, maxGrade: 10 };
    }
    return { ...defaultGradingSystem };
};

export const normalizeGradeTypes = (list?: GradeType[]): GradeType[] => {
    const defaults = getDefaultGradeTypes();
    if (!Array.isArray(list) || list.length === 0) return defaults;
    const seenKeys = new Set<string>();
    const result: GradeType[] = [];
    list.forEach((item, idx) => {
        if (!item || typeof item !== 'object') return;
        const rawKey = (item.key && String(item.key).trim()) || (item.id && String(item.id).trim()) || `gt_key_${idx}`;
        const rawName = String(item.name || '').trim();
        // Filter out removed default type "Раб. на уроке" (key 'rab')
        if (rawKey.toLowerCase() === 'rab' || rawName.toLowerCase() === 'раб. на уроке' || rawName.toLowerCase() === 'работа на уроке') {
            return;
        }
        const key = seenKeys.has(rawKey) ? `${rawKey}_${idx}` : rawKey;
        seenKeys.add(key);
        const normKey = normalizeGradeTypeKey(key);
        const cleanName = normKey === 'default'
            ? '...'
            : ((item.name && !/^[A-Z_]+$/.test(item.name)) ? item.name : (GRADE_TYPE_LABELS_RU[normKey] || item.name || '...'));
        result.push({
            ...item,
            id: (item.id && String(item.id).trim()) || `gt_id_${key}`,
            key,
            name: cleanName,
            weight: typeof item.weight === 'number' ? item.weight : 1
        });
    });
    // Ensure standard keys are available if not already present
    defaults.forEach(def => {
        if (!result.some(r => r.key === def.key || normalizeGradeTypeKey(r.key) === def.key)) {
            result.push(def);
        }
    });
    return result.length > 0 ? result : defaults;
};

export const getSchoolGradeTypes = (state: AppState, schoolId?: string): GradeType[] => {
    const school = getSchool(state, schoolId);
    if (school && Array.isArray(school.gradeTypes) && school.gradeTypes.length > 0) return normalizeGradeTypes(school.gradeTypes);
    if ((!schoolId || schoolId === 'global' || schoolId === 'school_1') && Array.isArray(state?.gradeTypes) && state.gradeTypes.length > 0) return normalizeGradeTypes(state.gradeTypes);
    return getDefaultGradeTypes();
};

export const getSchoolScheduleSettings = (state: AppState, schoolId?: string): ScheduleSettings => {
    const school = getSchool(state, schoolId);
    if (school && school.scheduleSettings) return normalizeScheduleSettings(school.scheduleSettings);
    if ((!schoolId || schoolId === 'global' || schoolId === 'school_1') && state?.scheduleSettings) return normalizeScheduleSettings(state.scheduleSettings);
    return JSON.parse(JSON.stringify(defaultScheduleSettings));
};

export const getSchoolSubjectRequirements = (state: AppState, schoolId?: string): Record<string, Record<string, SubjectRequirement>> => {
    const school = getSchool(state, schoolId);
    if (school && school.subjectRequirements) return school.subjectRequirements;
    if ((!schoolId || schoolId === 'global' || schoolId === 'school_1') && state.subjectRequirements) return state.subjectRequirements;
    return {};
};

export const deduplicateClassesList = (list: { class: string; letter: string; headmasterId?: string }[]): { class: string; letter: string; headmasterId?: string }[] => {
    const seen = new Set<string>();
    const result: { class: string; letter: string; headmasterId?: string }[] = [];
    (list || []).forEach(c => {
        if (!c || !c.class || !c.letter) return;
        const key = `${c.class}_${c.letter}`;
        if (!seen.has(key)) {
            seen.add(key);
            result.push(c);
        }
    });
    return result;
};

export const getSchoolClasses = (state: AppState, schoolId?: string): { class: string; letter: string; headmasterId?: string }[] => {
    if (!schoolId || schoolId === 'global') {
        const all: { class: string; letter: string; headmasterId?: string }[] = [];
        (state.schools || []).forEach(s => {
            (s.classes || []).forEach(c => all.push(c));
        });
        const result = deduplicateClassesList(all);
        if (result.length > 0) {
            result.sort((a, b) => parseInt(a.class) - parseInt(b.class) || a.letter.localeCompare(b.letter));
            return result;
        }
        if (Array.isArray(state.classes) && state.classes.length > 0) {
            return deduplicateClassesList(state.classes);
        }
        return [{ class: '10', letter: 'А', headmasterId: 'u_teacher' }];
    }
    const school = getSchool(state, schoolId);
    if (school && Array.isArray(school.classes)) {
        if (school.classes.length > 0 || schoolId !== 'school_1') {
            return deduplicateClassesList(school.classes);
        }
    }
    if ((!schoolId || schoolId === 'school_1') && Array.isArray(state.classes) && state.classes.length > 0) {
        return deduplicateClassesList(state.classes);
    }
    return (!schoolId || schoolId === 'school_1') ? [{ class: '10', letter: 'А', headmasterId: 'u_teacher' }] : [];
};

export const setSchoolClasses = (state: AppState, schoolId: string | undefined, classes: { class: string; letter: string; headmasterId?: string }[]) => {
    if (schoolId && schoolId !== 'global') {
        const school = getSchool(state, schoolId);
        if (school) {
            school.classes = classes;
        }
    }
    if (!schoolId || schoolId === 'global' || schoolId === 'school_1' || state.schools?.[0]?.id === schoolId) {
        state.classes = classes;
    }
    if (state.schools && state.schools[0] && (!schoolId || schoolId === 'global' || state.schools[0].id === schoolId)) {
        state.schools[0].classes = classes;
    }
};

export const getUserLeadingClasses = (state: AppState, schoolId: string | undefined, userId: string): { class: string; letter: string; headmasterId?: string }[] => {
    if (!userId) return [];
    const classes = getSchoolClasses(state, schoolId);
    return classes.filter(c => c.headmasterId === userId);
};

export const getClassHeadmaster = (state: AppState, schoolId: string | undefined, classNum: string, classLetter: string): User | null => {
    const classes = getSchoolClasses(state, schoolId);
    const cls = classes.find(c => c.class === classNum && c.letter === classLetter);
    if (!cls || !cls.headmasterId) return null;
    return state.users.find(u => u.id === cls.headmasterId && (!schoolId || schoolId === 'global' || !u.schoolId || u.schoolId === schoolId)) || null;
};

export const getEligibleHeadmasterCandidates = (state: AppState, schoolId: string | undefined): User[] => {
    return state.users.filter(u => {
        if (schoolId && u.schoolId && u.schoolId !== schoolId) return false;
        if ((u.role as string) === 'creator') return false;
        return u.role === 'teacher' || u.role === 'employee' || u.role === 'director';
    });
};

export const canUserBeAssignedAsHeadmaster = (
    state: AppState, 
    schoolId: string | undefined, 
    candidateId: string, 
    currentClassNum: string, 
    currentClassLetter: string
): { canAssign: boolean; currentCount: number; leadingClasses: string[] } => {
    const classes = getSchoolClasses(state, schoolId);
    const leading = classes.filter(c => c.headmasterId === candidateId);
    const leadingNames = leading.map(c => `${c.class}${c.letter}`);
    const isAlreadyThisClass = leading.some(c => c.class === currentClassNum && c.letter === currentClassLetter);
    
    // If user already leads this class, they can stay
    if (isAlreadyThisClass) {
        return { canAssign: true, currentCount: leading.length, leadingClasses: leadingNames };
    }
    
    // Max 2 classes per person
    const canAssign = leading.length < 2;
    return { canAssign, currentCount: leading.length, leadingClasses: leadingNames };
};

export const setClassHeadmaster = (
    state: AppState, 
    schoolId: string | undefined, 
    classNum: string, 
    classLetter: string, 
    headmasterId?: string
): void => {
    if (schoolId && schoolId !== 'global') {
        const school = getSchool(state, schoolId);
        if (school) {
            if (!Array.isArray(school.classes)) school.classes = [];
            const cls = school.classes.find(c => c.class === classNum && c.letter === classLetter);
            if (cls) {
                cls.headmasterId = headmasterId || undefined;
            }
            if (schoolId === 'school_1' || state.schools?.[0]?.id === schoolId) {
                state.classes = school.classes;
            }
            return;
        }
    }
    if (Array.isArray(state.classes)) {
        const cls = state.classes.find(c => c.class === classNum && c.letter === classLetter);
        if (cls) {
            cls.headmasterId = headmasterId || undefined;
        }
    }
};

export const DEFAULT_SUBJECTS: string[] = [
    'Русский язык',
    'Литература',
    'Математика',
    'Алгебра',
    'Геометрия',
    'Информатика',
    'Физика',
    'Химия',
    'Биология',
    'История',
    'Обществознание',
    'География',
    'Иностранный язык',
    'Английский язык',
    'Физкультура',
    'ОБЖ',
    'Технология',
    'Музыка',
    'ИЗО',
    'Окружающий мир'
];

export const getSchoolSubjects = (state: AppState, schoolId?: string): string[] => {
    if (schoolId && schoolId !== 'global') {
        const school = getSchool(state, schoolId);
        if (school && Array.isArray(school.subjects) && school.subjects.length > 0) {
            return Array.from(new Set(school.subjects.filter(Boolean)));
        }
    }
    if (!schoolId || schoolId === 'global') {
        const allSubs = new Set<string>(DEFAULT_SUBJECTS);
        if (Array.isArray(state.subjects)) {
            state.subjects.filter(Boolean).forEach(s => allSubs.add(s));
        }
        if (Array.isArray(state.schools)) {
            state.schools.forEach(sc => {
                if (Array.isArray(sc.subjects)) {
                    sc.subjects.filter(Boolean).forEach(s => allSubs.add(s));
                }
            });
        }
        if (state.grades) {
            Object.values(state.grades).forEach(subMap => {
                if (subMap && typeof subMap === 'object') {
                    Object.keys(subMap).filter(Boolean).forEach(s => allSubs.add(s));
                }
            });
        }
        return Array.from(allSubs);
    }
    if (schoolId === 'school_1' && Array.isArray(state.subjects) && state.subjects.length > 0) {
        return Array.from(new Set(state.subjects.filter(Boolean)));
    }
    return [...DEFAULT_SUBJECTS];
};

export const setSchoolSubjects = (state: AppState, schoolId: string | undefined, subjects: string[]) => {
    if (schoolId && schoolId !== 'global') {
        const school = getSchool(state, schoolId);
        if (school) {
            school.subjects = subjects;
        }
    }
    if (!schoolId || schoolId === 'global' || schoolId === 'school_1' || state.schools?.[0]?.id === schoolId) {
        state.subjects = subjects;
    }
    if (state.schools && state.schools[0] && (!schoolId || schoolId === 'global' || state.schools[0].id === schoolId)) {
        state.schools[0].subjects = subjects;
    }
};

export const getSchoolClassKey = (schoolId: string | undefined, classKey: string): string => {
    if (!classKey) return '';
    const pureKey = classKey.includes('__') ? classKey.split('__').pop() || classKey : classKey;
    if (schoolId) return `${schoolId}__${pureKey}`;
    return pureKey;
};

export const deduplicateScheduleDays = (daysObj: Record<string, ScheduleDay> | undefined): Record<string, ScheduleDay> => {
    if (!daysObj || typeof daysObj !== 'object') return {};
    const byDate = new Map<string, { key: string; day: ScheduleDay; score: number }>();
    for (const [k, day] of Object.entries(daysObj)) {
        if (!day || !day.date) continue;
        const lessons = Array.isArray(day.lessons) ? day.lessons : [];
        const filledCount = lessons.filter(l => l && (l.lesson || (l.subgroups && l.subgroups.length > 0))).length;
        const existing = byDate.get(day.date);
        const computedTitle = day.title && day.title.trim() ? day.title : getDayOfWeek(day.date, 'ru');
        if (!existing || filledCount >= existing.score) {
            byDate.set(day.date, { key: k, day: { ...day, id: day.id || k, title: computedTitle, lessons }, score: filledCount });
        }
    }
    const result: Record<string, ScheduleDay> = {};
    for (const { key, day } of byDate.values()) {
        result[key] = day;
    }
    return result;
};

export const getSchoolClassSchedule = (state: AppState, schoolId: string | undefined, classKey: string): Record<string, ScheduleDay> => {
    if (!state.schedules || !classKey) return {};
    const pureKey = classKey.includes('__') ? classKey.split('__').pop() || classKey : classKey;
    if (schoolId) {
        const scopedKey = `${schoolId}__${pureKey}`;
        return deduplicateScheduleDays(state.schedules[scopedKey] || (schoolId === 'school_1' ? state.schedules[pureKey] : {}) || {});
    }
    return deduplicateScheduleDays(state.schedules[pureKey] || {});
};

export const setSchoolClassSchedule = (state: AppState, schoolId: string | undefined, classKey: string, schedule: Record<string, ScheduleDay>): void => {
    if (!state.schedules) state.schedules = {};
    const targetKey = getSchoolClassKey(schoolId, classKey);
    state.schedules[targetKey] = schedule;
};

export const getSchoolClassGrades = (state: AppState, schoolId: string | undefined, classKey: string): Record<string, Grade[]> => {
    if (!state.grades || !classKey) return {};
    const pureKey = classKey.includes('__') ? classKey.split('__').pop() || classKey : classKey;
    const rawMap = schoolId
        ? (state.grades[`${schoolId}__${pureKey}`] || (schoolId === 'school_1' ? state.grades[pureKey] : undefined) || {})
        : (state.grades[pureKey] || {});

    // Check if this class has a defined schedule so we only keep grades on dates where the subject has a lesson
    const classSchedule = getSchoolClassSchedule(state, schoolId, pureKey);
    const scheduleDaysByDate = new Map<string, ScheduleDay>();
    Object.values(classSchedule).forEach(d => {
        if (d && d.date) scheduleDaysByDate.set(d.date, d);
    });
    const hasDefinedSchedule = scheduleDaysByDate.size > 0;

    const normalizedResult: Record<string, Grade[]> = {};
    for (const [subj, gradeList] of Object.entries(rawMap)) {
        if (!Array.isArray(gradeList)) continue;
        const seen = new Map<string, Grade>();
        gradeList.forEach(g => {
            if (!g || !g.studentId || !g.date) return;
            // If the class has a schedule for this date, verify the subject is actually taught on this date
            if (hasDefinedSchedule) {
                const dayObj = scheduleDaysByDate.get(g.date);
                if (!dayObj) return;
                const subjectLessonCount = (dayObj.lessons || []).filter(l => {
                    if (l.subgroups && l.subgroups.length > 0) {
                        return l.subgroups.some(sg => sg.subject === subj);
                    }
                    return l.lesson === subj;
                }).length;
                if (subjectLessonCount === 0) return;
            }
            const normType = normalizeGradeTypeKey(g.type);
            const lIdx = typeof g.lessonIndex === 'number' && g.lessonIndex >= 0 ? g.lessonIndex : 0;
            const dedupKey = `${g.studentId}__${g.date}__${lIdx}`;
            seen.set(dedupKey, {
                ...g,
                type: normType,
                lessonIndex: lIdx
            });
        });
        normalizedResult[subj] = Array.from(seen.values());
    }
    return normalizedResult;
};

export const setSchoolClassGrades = (state: AppState, schoolId: string | undefined, classKey: string, grades: Record<string, Grade[]>): void => {
    if (!state.grades) state.grades = {};
    const pureKey = classKey.includes('__') ? classKey.split('__').pop() || classKey : classKey;
    const targetKey = getSchoolClassKey(schoolId, pureKey);
    state.grades[targetKey] = grades;
    if (schoolId === 'school_1' && targetKey !== pureKey && state.grades[pureKey]) {
        delete state.grades[pureKey];
    }
};

export const getSchoolClassFinalGrades = (state: AppState, schoolId: string | undefined, classKey: string): Record<string, FinalGradeEntry[]> => {
    if (!state.finalGrades || !classKey) return {};
    const pureKey = classKey.includes('__') ? classKey.split('__').pop() || classKey : classKey;
    if (schoolId) {
        const scopedKey = `${schoolId}__${pureKey}`;
        return state.finalGrades[scopedKey] || (schoolId === 'school_1' ? state.finalGrades[pureKey] : undefined) || {};
    }
    return state.finalGrades[pureKey] || {};
};

export const setSchoolClassFinalGrades = (state: AppState, schoolId: string | undefined, classKey: string, finalGrades: Record<string, FinalGradeEntry[]>): void => {
    if (!state.finalGrades) state.finalGrades = {};
    const pureKey = classKey.includes('__') ? classKey.split('__').pop() || classKey : classKey;
    const targetKey = getSchoolClassKey(schoolId, pureKey);
    state.finalGrades[targetKey] = finalGrades;
    if (schoolId === 'school_1' && targetKey !== pureKey && state.finalGrades[pureKey]) {
        delete state.finalGrades[pureKey];
    }
};

export const getSchoolUsers = (state: AppState, schoolId?: string): User[] => {
    if (!state.users) return [];
    if (!schoolId) return state.users;
    return state.users.filter(u => u.schoolId === schoolId);
};

export const getSchoolHomework = (state: AppState, schoolId?: string, classKey?: string): Homework[] => {
    if (!state.homework) return [];
    let list = state.homework;
    if (schoolId) {
        list = list.filter(h => {
            if (h.schoolId) return h.schoolId === schoolId;
            const author = state.users.find(u => u.id === h.fromId);
            return author ? author.schoolId === schoolId : schoolId === 'school_1';
        });
    }
    if (classKey) {
        const parts = classKey.split('_');
        const cNum = parts[0];
        const cLet = parts[1];
        list = list.filter(h => h.class === cNum && (!cLet || h.letter === cLet));
    }
    // Deduplicate and merge homework entries for the same class + letter + date + subject + lessonIndex
    // so that text paragraphs appear together and all attachments are grouped at the very end
    const grouped = new Map<string, Homework>();
    list.forEach(h => {
        const key = `${h.schoolId || ''}__${h.class}_${h.letter}__${h.date}__${h.subject}__${h.lessonIndex || 0}`;
        const existing = grouped.get(key);
        if (!existing) {
            grouped.set(key, {
                ...h,
                attachments: h.attachments ? [...h.attachments] : undefined
            });
        } else {
            const existingTexts = existing.text ? existing.text.split('\n').map(s => s.trim()) : [];
            const incomingText = (h.text || '').trim();
            if (incomingText && !existingTexts.includes(incomingText)) {
                existing.text = existing.text ? `${existing.text}\n${incomingText}` : incomingText;
            }
            const mergedAttachments: { id: string; name: string; type: string }[] = [];
            const addAtt = (id?: string, name?: string, type?: string) => {
                if (!id || !name) return;
                if (!mergedAttachments.some(a => a.id === id || a.name === name)) {
                    mergedAttachments.push({ id, name, type: type || 'application/octet-stream' });
                }
            };
            if (existing.attachmentId && existing.attachmentName) addAtt(existing.attachmentId, existing.attachmentName);
            (existing.attachments || []).forEach(a => addAtt(a.id, a.name, a.type));
            if (h.attachmentId && h.attachmentName) addAtt(h.attachmentId, h.attachmentName);
            (h.attachments || []).forEach(a => addAtt(a.id, a.name, a.type));
            existing.attachmentId = undefined;
            existing.attachmentName = undefined;
            existing.attachments = mergedAttachments.length > 0 ? mergedAttachments : undefined;
        }
    });
    return Array.from(grouped.values());
};

export const getSchoolTeacherAssignments = (state: AppState, schoolId?: string): TeacherAssignment[] => {
    if (!state.teacherAssignments) return [];
    if (!schoolId) return state.teacherAssignments;
    return state.teacherAssignments.filter(a => {
        if (a.schoolId) return a.schoolId === schoolId;
        const teacher = state.users.find(u => u.id === a.teacherId);
        return teacher ? teacher.schoolId === schoolId : schoolId === 'school_1';
    });
};

export const getSchoolStudentGroups = (state: AppState, schoolId?: string, classKey?: string): StudentGroup[] => {
    if (!state.studentGroups) return [];
    let list = state.studentGroups;
    if (schoolId) {
        list = list.filter(g => {
            if (g.schoolId) return g.schoolId === schoolId;
            const firstStudent = state.users.find(u => g.studentIds.includes(u.id));
            return firstStudent ? firstStudent.schoolId === schoolId : schoolId === 'school_1';
        });
    }
    if (classKey) {
        const pureKey = classKey.includes('__') ? classKey.split('__').pop() || classKey : classKey;
        list = list.filter(g => {
            const gPureKey = g.classId.includes('__') ? g.classId.split('__').pop() || g.classId : g.classId;
            return gPureKey === pureKey;
        });
    }
    return list;
};

export const setSchoolGradingSystem = (state: AppState, schoolId: string | undefined, gradingSystem: GradingSystemSettings) => {
    if (schoolId) {
        const school = getSchool(state, schoolId);
        if (school) {
            school.gradingSystem = gradingSystem;
            return;
        }
    }
    state.gradingSystem = gradingSystem;
};

export const setSchoolGradeTypes = (state: AppState, schoolId: string | undefined, gradeTypes: GradeType[]) => {
    if (schoolId) {
        const school = getSchool(state, schoolId);
        if (school) {
            school.gradeTypes = gradeTypes;
            return;
        }
    }
    state.gradeTypes = gradeTypes;
};

export const setSchoolScheduleSettings = (state: AppState, schoolId: string | undefined, scheduleSettings: ScheduleSettings) => {
    if (schoolId) {
        const school = getSchool(state, schoolId);
        if (school) {
            school.scheduleSettings = scheduleSettings;
            return;
        }
    }
    state.scheduleSettings = scheduleSettings;
};

export const setSchoolSubjectRequirements = (state: AppState, schoolId: string | undefined, reqs: Record<string, Record<string, SubjectRequirement>>) => {
    if (schoolId) {
        const school = getSchool(state, schoolId);
        if (school) {
            school.subjectRequirements = reqs;
            return;
        }
    }
    state.subjectRequirements = reqs;
};

export const clearSchoolGrades = (state: AppState, schoolId: string | undefined) => {
    if (!schoolId) {
        state.grades = {};
        state.finalGrades = {};
        return;
    }
    const schoolClasses = getSchoolClasses(state, schoolId);
    schoolClasses.forEach(c => {
        const pureKey = `${c.class}_${c.letter}`;
        const scopedKey = `${schoolId}__${pureKey}`;
        if (state.grades) {
            delete state.grades[scopedKey];
            if (state.grades[pureKey]) {
                const hasOtherSchoolGrades = Object.values(state.grades[pureKey]).some(gradeArr => 
                    gradeArr.some(g => {
                        const student = state.users.find(u => u.id === g.studentId);
                        return student && student.schoolId && student.schoolId !== schoolId;
                    })
                );
                if (!hasOtherSchoolGrades) {
                    delete state.grades[pureKey];
                }
            }
        }
        if (state.finalGrades) {
            delete state.finalGrades[scopedKey];
            if (state.finalGrades[pureKey]) {
                const hasOtherSchoolFinalGrades = Object.values(state.finalGrades[pureKey]).some(fgArr => 
                    fgArr.some(fg => {
                        const student = state.users.find(u => u.id === fg.studentId);
                        return student && student.schoolId && student.schoolId !== schoolId;
                    })
                );
                if (!hasOtherSchoolFinalGrades) {
                    delete state.finalGrades[pureKey];
                }
            }
        }
    });
};

// ==========================================
// --- SECURITY & XSS SANITIZATION HELPERS ---
// ==========================================

export const sanitizeInputText = (val: string): string => {
    if (typeof val !== 'string' || !val) return '';
    return val
        // Remove <script>...</script> and standalone <script...> or </script> tags
        .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
        .replace(/<\s*\/?\s*script[^>]*>/gi, '')
        // Remove dangerous embedded tags (<iframe, <object, <embed, <applet, <meta, <link)
        .replace(/<\s*\/?\s*(iframe|object|embed|applet|meta|link|base|form)\b[^>]*>/gi, '')
        // Neutralize inline event handlers like onerror=, onload=, onclick=
        .replace(/\bon[a-z]{2,25}\s*=/gi, 'data-blocked-event=')
        // Neutralize javascript:, vbscript:, data:text/html protocols
        .replace(/(?:javascript|vbscript)\s*:/gi, 'blocked:')
        .replace(/data\s*:\s*text\/html/gi, 'blocked:text/plain');
};

export const sanitizeCssIdentifier = (name: string): string => {
    if (typeof name !== 'string' || !name) return 'CustomFont';
    return name.replace(/["'\\<>{};()[\]`]/g, '').trim() || 'CustomFont';
};

export const sanitizeSafeUrl = (
    url: string | undefined | null,
    mode: 'image' | 'video' | 'iframe' | 'background' = 'image'
): string => {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (!trimmed) return '';

    // Check decoded URL for obfuscated protocols
    let decoded = trimmed;
    try {
        decoded = decodeURIComponent(trimmed);
    } catch {
        decoded = trimmed;
    }
    const normalized = decoded.replace(/[\s\x00-\x1f]+/g, '').toLowerCase();

    if (
        normalized.startsWith('javascript:') ||
        normalized.startsWith('vbscript:') ||
        normalized.startsWith('data:text/html') ||
        normalized.startsWith('data:application/')
    ) {
        return '';
    }

    if (mode === 'iframe') {
        // Iframes are strictly limited to https:// origins
        if (/^https:\/\/[a-z0-9.-]+/i.test(trimmed)) {
            return trimmed;
        }
        return '';
    }

    if (normalized.startsWith('data:image/svg+xml')) {
        // Block SVG data URLs that contain script tags or inline event handlers
        if (/<\s*script|\bon[a-z]+\s*=|javascript:/i.test(decoded)) {
            return '';
        }
        return trimmed;
    }

    if (
        /^https?:\/\//i.test(trimmed) ||
        trimmed.startsWith('/') ||
        trimmed.startsWith('blob:') ||
        /^data:image\/(png|jpeg|jpg|webp|gif|bmp);base64,/i.test(trimmed) ||
        (mode === 'video' && /^data:video\/(mp4|webm|ogg);base64,/i.test(trimmed))
    ) {
        return trimmed;
    }

    return '';
};

export const sanitizeRichHtml = (html: string): string => {
    if (!html || typeof html !== 'string') return '';
    // Pre-clean any inline script/event attributes before DOMPurify
    const preCleaned = sanitizeInputText(html);
    return DOMPurify.sanitize(preCleaned, {
        ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$)|data:image\/(?:svg\+xml|png|jpeg|jpg|gif|webp|bmp))/i
    });
};

// ==========================================
// --- RICH ILLUSTRATED ELJUR PRESENTATION ---
// ==========================================

const SVG_HERO_ECOSYSTEM = `data:image/svg+xml;utf8,` + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 860 280" width="860" height="280">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e3a8a"/>
      <stop offset="50%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#4f46e5"/>
    </linearGradient>
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.96"/>
      <stop offset="100%" stop-color="#f8fafc" stop-opacity="0.92"/>
    </linearGradient>
  </defs>
  <rect width="860" height="280" rx="24" fill="url(#bgGrad)"/>
  <circle cx="780" cy="40" r="110" fill="#60a5fa" opacity="0.18"/>
  <circle cx="80" cy="240" r="130" fill="#818cf8" opacity="0.18"/>
  <!-- Left Hero Text -->
  <rect x="42" y="38" width="148" height="28" rx="14" fill="#ffffff" fill-opacity="0.18"/>
  <text x="116" y="57" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="700" fill="#e0f2fe" text-anchor="middle">ЭЛЖУР v7 RELEASE</text>
  <text x="42" y="106" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="800" fill="#ffffff">Единая цифровая</text>
  <text x="42" y="142" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="800" fill="#93c5fd">образовательная среда</text>
  <text x="42" y="178" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="500" fill="#dbeafe">Электронный журнал, умное расписание, дневник,</text>
  <text x="42" y="198" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="500" fill="#dbeafe">аналитика успеваемости и защищенный документооборот</text>
  <rect x="42" y="220" width="120" height="32" rx="10" fill="#10b981"/>
  <text x="102" y="241" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="700" fill="#ffffff" text-anchor="middle">100% Cloud Sync</text>
  <rect x="174" y="220" width="136" height="32" rx="10" fill="#ffffff" fill-opacity="0.16"/>
  <text x="242" y="241" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="700" fill="#ffffff" text-anchor="middle">Защита от XSS / RBAC</text>
  <!-- Right Mockup Dashboard Card -->
  <rect x="450" y="28" width="372" height="224" rx="18" fill="url(#cardGrad)"/>
  <rect x="470" y="46" width="36" height="36" rx="10" fill="#2563eb"/>
  <text x="488" y="71" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="800" fill="#ffffff" text-anchor="middle">Э</text>
  <text x="518" y="62" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="800" fill="#0f172a">Журнал успеваемости • 10-А</text>
  <text x="518" y="78" font-family="Inter, Arial, sans-serif" font-size="11" font-weight="600" fill="#64748b">Ср. балл класса: 4.68 • Успеваемость: 100%</text>
  <!-- Mini Table Rows -->
  <rect x="470" y="96" width="332" height="34" rx="8" fill="#f1f5f9"/>
  <text x="484" y="118" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="700" fill="#1e293b">Кузнецов Алексей</text>
  <rect x="652" y="102" width="26" height="22" rx="6" fill="#dcfce7"/>
  <text x="665" y="117" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="800" fill="#15803d" text-anchor="middle">5</text>
  <rect x="684" y="102" width="26" height="22" rx="6" fill="#dcfce7"/>
  <text x="697" y="117" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="800" fill="#15803d" text-anchor="middle">5</text>
  <rect x="716" y="102" width="26" height="22" rx="6" fill="#dbeafe"/>
  <text x="729" y="117" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="800" fill="#1d4ed8" text-anchor="middle">4</text>
  <rect x="752" y="102" width="40" height="22" rx="6" fill="#1e293b"/>
  <text x="772" y="117" font-family="Inter, Arial, sans-serif" font-size="11" font-weight="800" fill="#ffffff" text-anchor="middle">4.82</text>

  <rect x="470" y="138" width="332" height="34" rx="8" fill="#f8fafc"/>
  <text x="484" y="160" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="700" fill="#1e293b">Соколова Мария</text>
  <rect x="652" y="144" width="26" height="22" rx="6" fill="#dcfce7"/>
  <text x="665" y="159" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="800" fill="#15803d" text-anchor="middle">5</text>
  <rect x="684" y="144" width="26" height="22" rx="6" fill="#dcfce7"/>
  <text x="697" y="159" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="800" fill="#15803d" text-anchor="middle">5</text>
  <rect x="716" y="144" width="26" height="22" rx="6" fill="#dcfce7"/>
  <text x="729" y="159" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="800" fill="#15803d" text-anchor="middle">5</text>
  <rect x="752" y="144" width="40" height="22" rx="6" fill="#059669"/>
  <text x="772" y="159" font-family="Inter, Arial, sans-serif" font-size="11" font-weight="800" fill="#ffffff" text-anchor="middle">5.00</text>

  <!-- Mini Analytics Bar -->
  <rect x="470" y="182" width="158" height="54" rx="10" fill="#eff6ff"/>
  <text x="484" y="202" font-family="Inter, Arial, sans-serif" font-size="11" font-weight="700" fill="#1d4ed8">Контроль конфликтов</text>
  <text x="484" y="222" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="800" fill="#0f172a">0 накладок уроков</text>
  <rect x="640" y="182" width="162" height="54" rx="10" fill="#ecfdf5"/>
  <text x="654" y="202" font-family="Inter, Arial, sans-serif" font-size="11" font-weight="700" fill="#047857">Обмен документами</text>
  <text x="654" y="222" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="800" fill="#0f172a">Файлы до 10 МБ</text>
</svg>`);

const SVG_GRADEBOOK_ANALYTICS = `data:image/svg+xml;utf8,` + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 214" width="880" height="214">
  <rect width="880" height="214" rx="20" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/>
  <!-- Card 1: Weighted Grades -->
  <rect x="20" y="22" width="268" height="170" rx="14" fill="#ffffff" stroke="#dbeafe" stroke-width="2"/>
  <rect x="34" y="38" width="40" height="40" rx="10" fill="#eff6ff"/>
  <text x="54" y="64" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="800" fill="#2563eb" text-anchor="middle">5+</text>
  <text x="84" y="55" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="800" fill="#0f172a">Умные веса оценок</text>
  <text x="84" y="72" font-family="Inter, Arial, sans-serif" font-size="10.5" font-weight="600" fill="#64748b">Авторасчет средневзвешенного</text>
  <text x="34" y="106" font-family="Inter, Arial, sans-serif" font-size="11.5" fill="#334155">• Контрольная работа (вес ×5)</text>
  <text x="34" y="128" font-family="Inter, Arial, sans-serif" font-size="11.5" fill="#334155">• Самостоятельная (вес ×3)</text>
  <text x="34" y="150" font-family="Inter, Arial, sans-serif" font-size="11.5" fill="#334155">• Ответ на уроке / ДЗ (вес ×1)</text>
  <text x="34" y="174" font-family="Inter, Arial, sans-serif" font-size="11" font-weight="700" fill="#059669">✓ Поддержка оценок 5/4 и зачетов</text>

  <!-- Card 2: Smart Schedule -->
  <rect x="306" y="22" width="268" height="170" rx="14" fill="#ffffff" stroke="#e0e7ff" stroke-width="2"/>
  <rect x="320" y="38" width="40" height="40" rx="10" fill="#eef2ff"/>
  <text x="340" y="63" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="800" fill="#4f46e5" text-anchor="middle">24/7</text>
  <text x="370" y="55" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="800" fill="#0f172a">Конструктор расписания</text>
  <text x="370" y="72" font-family="Inter, Arial, sans-serif" font-size="10.5" font-weight="600" fill="#64748b">Деление на подгруппы</text>
  <text x="320" y="106" font-family="Inter, Arial, sans-serif" font-size="11.5" fill="#334155">• Защита от накладок учителей</text>
  <text x="320" y="128" font-family="Inter, Arial, sans-serif" font-size="11.5" fill="#334155">• Контроль занятости кабинетов</text>
  <text x="320" y="150" font-family="Inter, Arial, sans-serif" font-size="11.5" fill="#334155">• Копирование недели в 1 клик</text>
  <text x="320" y="174" font-family="Inter, Arial, sans-serif" font-size="11" font-weight="700" fill="#4f46e5">✓ Учет каникул и праздников</text>

  <!-- Card 3: Security & Isolation -->
  <rect x="592" y="22" width="268" height="170" rx="14" fill="#ffffff" stroke="#d1fae5" stroke-width="2"/>
  <rect x="606" y="38" width="40" height="40" rx="10" fill="#ecfdf5"/>
  <path d="M626 48 L634 52 V58 C634 63.5 630.5 68 626 70 C621.5 68 618 63.5 618 58 V52 Z" fill="none" stroke="#059669" stroke-width="2" stroke-linejoin="round"/>
  <text x="656" y="55" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="800" fill="#0f172a">Безопасность и облако</text>
  <text x="656" y="72" font-family="Inter, Arial, sans-serif" font-size="10.5" font-weight="600" fill="#64748b">Изоляция школ + защита данных</text>
  <text x="606" y="106" font-family="Inter, Arial, sans-serif" font-size="11.5" fill="#334155">• Полная изоляция данных школ</text>
  <text x="606" y="128" font-family="Inter, Arial, sans-serif" font-size="11.5" fill="#334155">• Анти-XSS фильтрация всех полей</text>
  <text x="606" y="150" font-family="Inter, Arial, sans-serif" font-size="11.5" fill="#334155">• Статусы прочтения сообщений</text>
  <text x="606" y="174" font-family="Inter, Arial, sans-serif" font-size="11" font-weight="700" fill="#059669">✓ Мгновенная печать ведомостей</text>
</svg>`);

export const DEFAULT_ELJUR_INFO_HTML = `
<p><img src="${SVG_HERO_ECOSYSTEM}" alt="ЭлЖур — Цифровая образовательная платформа" /></p>
<h2><strong>О платформе «ЭлЖур» (Электронный Школьный Журнал v7 Release)</strong></h2>
<p><strong>«ЭлЖур»</strong> — это современная высоконадежная облачная система управления образовательным процессом, созданная специально для общеобразовательных школ, лицеев и гимназий. Платформа объединяет администрацию, учителей, сотрудников, классных руководителей и учеников в едином защищенном цифровом пространстве с мгновенной синхронизацией в реальном времени.</p>
<p><img src="${SVG_GRADEBOOK_ANALYTICS}" alt="Ключевые модули системы ЭлЖур" /></p>
<h3><strong>Ключевые преимущества и возможности системы</strong></h3>
<ul>
  <li><strong>Интеллектуальный электронный журнал и система весов:</strong> поддержка гибкой шкалы оценивания (2–5, 1–10 или 1–100 баллов), весовых коэффициентов по видам работ (контрольная, самостоятельная, диктант, домашняя работа, ответ на уроке), двойных оценок (например, <code>5/4</code>), отметок посещаемости (<code>Н</code>, <code>УВ</code>, <code>Б</code>, <code>ОП</code>) и зачетных отметок (<code>ЗЧ</code>, <code>НЗ</code>).</li>
  <li><strong>Автоматический контроль задолженностей «Н/У»:</strong> отметка о невыполненной работе (<code>Н/У</code>) имеет настраиваемый срок исправления (дедлайн). Если ученик не закрывает задолженность вовремя, система автоматически учитывает её при расчете среднего балла, мотивируя своевременную сдачу работ.</li>
  <li><strong>Умный конструктор расписания без накладок:</strong> поддержка деления классов на учебные подгруппы (иностранные языки, информатика, профильные предметы), автоматическая проверка занятости учителей и кабинетов в реальном времени, а также учет государственных праздников и межчетвертных каникул.</li>
  <li><strong>Защищенная внутренняя почта и школьные объявления:</strong> мгновенная отправка личных и групповых сообщений (всему классу, всем учителям, классным руководителям, директорам школ или Создателю), прикрепление реальных файлов и документов (отчетов, приказов, методических материалов) с предпросмотром прямо в браузере и точным отслеживанием статуса прочтения (<em>«Просмотрено»</em> до и после редактирования с поиском по получателям).</li>
  <li><strong>Многоуровневая аналитика и межшкольный рейтинг:</strong> автоматическое построение рейтинга учеников и классов за любую четверть или учебный год с поддержкой нормализации разных шкал оценивания (5-балльная, 10-балльная, 100-балльная и процентная шкала), фильтрацией по профилям и предметам, и печатью ведомостей в один клик.</li>
  <li><strong>Многошкольная архитектура и максимальная безопасность:</strong> данные каждой школы полностью изолированы в облачной базе данных. Все пользовательские поля ввода, текстовые редакторы и вложения защищены многослойной фильтрацией от выполнения вредоносных скриптов (XSS-защита, санитизация HTML/SVG и ролевой контроль доступа RBAC).</li>
</ul>
<h3><strong>Возможности для каждой роли в школе</strong></h3>
<ul>
  <li><strong>Для Директора и Администрации:</strong> полное управление контингентом школы, распределение педагогической нагрузки, назначение классных руководителей, настройка весов оценок и четвертей, сводный рейтинг школы и выпуск общешкольных объявлений.</li>
  <li><strong>Для Учителя и Классного руководителя:</strong> быстрое выставление оценок с комментариями, выдача домашних заданий с прикреплением файлов, персональное расписание уроков, сводная ведомость своего класса и связь с учениками и руководством.</li>
  <li><strong>Для Ученика:</strong> интерактивный дневник с расписанием, темами и домашними заданиями, детальная статистика успеваемости по каждому предмету, калькулятор прогнозируемого среднего балла и получение учебных материалов от учителей.</li>
</ul>
`.trim();

export const getSchoolEljurInfo = (state: AppState, schoolId: string | undefined): string => {
    const isPlaceholderInfo = (val?: string) => {
        if (!val || !val.trim()) return true;
        const stripped = val.replace(/<[^>]*>/g, '').trim();
        return stripped === 'Добро пожаловать в электронный журнал.' || stripped === 'Welcome to the electronic journal.';
    };

    const upgradeLegacySvg = (html: string): string => {
        let updated = html;
        // Automatically upgrade the older 800x210 SVG card banner or fixed-height SVGs
        if (updated.includes('viewBox%3D%220%200%20800%20210%22') || updated.includes('viewBox="0 0 800 210"')) {
            updated = updated.replace(/data:image\/svg\+xml;utf8,[^"']*viewBox%3D%220%200%20800%20210%22[^"']*/g, SVG_GRADEBOOK_ANALYTICS);
        }
        if (updated.includes('viewBox%3D%220%200%20860%20280%22%20width%3D%22100%25%22%20height%3D%22260%22')) {
            updated = updated.replace(/data:image\/svg\+xml;utf8,[^"']*viewBox%3D%220%200%20860%20280%22[^"']*/g, SVG_HERO_ECOSYSTEM);
        }
        if (updated.includes('viewBox%3D%220%200%20880%20214%22%20width%3D%22100%25%22%20height%3D%22204%22')) {
            updated = updated.replace(/data:image\/svg\+xml;utf8,[^"']*viewBox%3D%220%200%20880%20214%22[^"']*/g, SVG_GRADEBOOK_ANALYTICS);
        }
        // Self-heal any <img> tags whose data:image/svg+xml src was stripped by older DOMPurify settings
        updated = updated.replace(/<img(?![^>]*\bsrc=)[^>]*alt="ЭлЖур[^"]*"[^>]*>/gi, `<img src="${SVG_HERO_ECOSYSTEM}" alt="ЭлЖур — Цифровая образовательная платформа" />`);
        updated = updated.replace(/<img(?![^>]*\bsrc=)[^>]*alt="Ключевые модули[^"]*"[^>]*>/gi, `<img src="${SVG_GRADEBOOK_ANALYTICS}" alt="Ключевые модули системы ЭлЖур" />`);
        return updated;
    };

    if (schoolId) {
        const school = getSchool(state, schoolId);
        if (school && school.eljurInfo !== undefined && !isPlaceholderInfo(school.eljurInfo)) {
            return upgradeLegacySvg(school.eljurInfo);
        }
    }
    if (state?.settings?.eljurInfo && !isPlaceholderInfo(state.settings.eljurInfo)) {
        return upgradeLegacySvg(state.settings.eljurInfo);
    }
    return DEFAULT_ELJUR_INFO_HTML;
};

export const setSchoolEljurInfo = (state: AppState, schoolId: string | undefined, info: string): void => {
    if (schoolId) {
        const school = getSchool(state, schoolId);
        if (school) {
            school.eljurInfo = info;
            return;
        }
    }
    if (state.settings) {
        state.settings.eljurInfo = info;
    }
};

export const formatExternalResourceUrl = (rawUrl?: string): string => {
    if (!rawUrl) return '';
    const trimmed = rawUrl.trim();
    if (!trimmed) return '';
    if (/^(javascript|data|vbscript):/i.test(trimmed)) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
};

export const getSchoolEducationalResourceUrl = (state: AppState, schoolId: string | undefined): string => {
    if (!schoolId) return '';
    const school = getSchool(state, schoolId);
    if (school && typeof school.educationalResourceUrl === 'string') {
        return school.educationalResourceUrl.trim();
    }
    return '';
};
