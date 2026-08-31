
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
    school_users: 'Пользователи школы',
    global_list: 'Глобальный список',
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
    final_grades: 'Итоговые оценки',
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
    unknown: 'Unknown',
    list_empty: 'Список пуст',
    editing: 'Редактирование',
    new_announcement: 'Новое объявление',
    new_message: 'Новое сообщение',
    sent_by_emp: 'Отправлено сотрудником',
    class_teacher: 'Классный руководитель',
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
    assign_class_teacher: 'Классный руководитель',
    not_assigned: 'Не назначен',
    max_2_classes_reached: 'Лимит: 2 класса',
    class_performance: 'Сводная ведомость успеваемости',
    homeroom_grades: 'Оценки класса',
    student_grades_overview: 'Успеваемость учеников',
    all_quarters: 'Все четверти',
    final_grades: 'Итоговые оценки',
    whole_class_summary: 'Сводка по классу',
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
    school_users: 'School Users',
    global_list: 'Global List',
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
    final_grades: 'Final Grades',
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
    class_teacher: 'Homeroom Teacher',
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
    assign_class_teacher: 'Class Teacher',
    not_assigned: 'Not assigned',
    max_2_classes_reached: 'Limit: 2 classes',
    class_performance: 'Class Performance Sheet',
    homeroom_grades: 'Homeroom Grades',
    student_grades_overview: 'Student Performance Overview',
    all_quarters: 'All Quarters',
    final_grades: 'Final Grades',
    whole_class_summary: 'Class Summary',
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

export const getNextWorkingDate = (date: Date, skippedDays: number[]): Date => {
  let next = addDays(date, 1);
  while (skippedDays.includes(next.getDay())) {
    next = addDays(next, 1);
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

export const isHoliday = (dateStr: string, settings: ScheduleSettings): { title: string } | null => {
    const h = settings.holidays.find(x => x.date === dateStr);
    return h ? { title: h.title } : null;
};

// AUTO-VACATION LOGIC
const getGapVacation = (dateStr: string, settings: ScheduleSettings): { title: string } | null => {
    const qDefs = settings.quarterDefinitions;
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

export const getVacationForDay = (dateStr: string, settings: ScheduleSettings): { title: string } | null => {
    // 1. Explicit vacations
    const d = new Date(dateStr);
    const explicit = settings.vacations.find(vac => {
        const start = new Date(vac.start);
        const end = new Date(vac.end);
        return d >= start && d <= end;
    });
    if (explicit) return { title: explicit.title };

    // 2. Auto-gap vacations
    return getGapVacation(dateStr, settings);
};

export const getVacationForWeek = (weekStart: Date, settings: ScheduleSettings, visibleDates: string[]): { isFullWeek: boolean, title: string, emoji: string, range: string } | null => {
    // Determine if the majority of the week is a vacation
    const weekEnd = addDays(weekStart, 6);
    
    // Check explicit vacations
    const overlappingVacation = settings.vacations.find(v => {
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

export const getGradeColorClass = (val: string, min: number = 2, max: number = 5): string => {
    if (val === 'Н/У') return 'text-red-500'; // Special styling for N/U
    const num = parseFloat(val);
    if (isNaN(num)) return 'text-slate-700 dark:text-slate-300';
    
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

export const isMessageUnreadByUser = (m: Message, userId: string): boolean => {
    if (!m) return false;
    // Messages created by current user are not unread for them
    if (m.fromId === userId || m.realAuthorId === userId) return false;
    // Must be addressed to user
    if (!m.toIds || !m.toIds.includes(userId)) return false;
    // Check if user has read it
    if (m.readBy && m.readBy.includes(userId)) return false;
    return true;
};

export const isAnnouncementUnreadByUser = (a: Announcement, user: User, allUsers: User[]): boolean => {
    if (!a || !user) return false;
    // Announcements created by current user are not unread for them
    if (a.fromId === user.id || a.realAuthorId === user.id) return false;
    const sender = allUsers.find(u => u.id === a.fromId);
    if (!sender) return false;
    // Global announcements from creator or school-level announcements
    if ((sender.role as string) !== 'creator' && sender.schoolId !== user.schoolId) return false;
    // Check if user has read it
    if (a.readBy && a.readBy.includes(user.id)) return false;
    return true;
};

export const getUnreadMessagesCount = (state: AppState, user: User): number => {
    if (!state || !state.messages || !Array.isArray(state.messages) || !user) return 0;
    return state.messages.filter(m => isMessageUnreadByUser(m, user.id)).length;
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
    skippedWeekDays: [0],
    holidays: [],
    vacations: [],
    quarterDefinitions: {
        'Q1': { start: '', end: '' },
        'Q2': { start: '', end: '' },
        'Q3': { start: '', end: '' },
        'Q4': { start: '', end: '' }
    }
};

export const getSchool = (state: AppState, schoolId?: string): School | undefined => {
    if (!schoolId || !state.schools) return undefined;
    return state.schools.find(s => s.id === schoolId);
};

export const getSchoolGradingSystem = (state: AppState, schoolId?: string): GradingSystemSettings => {
    const school = getSchool(state, schoolId);
    if (school && school.gradingSystem) return school.gradingSystem;
    if (state.gradingSystem) return state.gradingSystem;
    return defaultGradingSystem;
};

export const getSchoolGradeTypes = (state: AppState, schoolId?: string): GradeType[] => {
    const school = getSchool(state, schoolId);
    if (school && school.gradeTypes && school.gradeTypes.length > 0) return school.gradeTypes;
    if (state.gradeTypes && state.gradeTypes.length > 0) return state.gradeTypes;
    return getDefaultGradeTypes();
};

export const getSchoolScheduleSettings = (state: AppState, schoolId?: string): ScheduleSettings => {
    const school = getSchool(state, schoolId);
    if (school && school.scheduleSettings) return school.scheduleSettings;
    if (state.scheduleSettings) return state.scheduleSettings;
    return defaultScheduleSettings;
};

export const getSchoolSubjectRequirements = (state: AppState, schoolId?: string): Record<string, Record<string, SubjectRequirement>> => {
    const school = getSchool(state, schoolId);
    if (school && school.subjectRequirements) return school.subjectRequirements;
    if (state.subjectRequirements) return state.subjectRequirements;
    return {};
};

export const getSchoolClasses = (state: AppState, schoolId?: string): { class: string; letter: string; headmasterId?: string }[] => {
    const school = getSchool(state, schoolId);
    if (school && school.classes && school.classes.length > 0) return school.classes;
    return state.classes || [];
};

export const setSchoolClasses = (state: AppState, schoolId: string | undefined, classes: { class: string; letter: string; headmasterId?: string }[]) => {
    if (schoolId) {
        const school = getSchool(state, schoolId);
        if (school) {
            school.classes = classes;
            return;
        }
    }
    state.classes = classes;
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
    return state.users.find(u => u.id === cls.headmasterId) || null;
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
    if (schoolId) {
        const school = getSchool(state, schoolId);
        if (school) {
            if (!school.classes) school.classes = [...(state.classes || [])];
            const cls = school.classes.find(c => c.class === classNum && c.letter === classLetter);
            if (cls) {
                cls.headmasterId = headmasterId || undefined;
            }
        }
    }
    if (state.classes) {
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
    const school = getSchool(state, schoolId);
    if (school && Array.isArray(school.subjects) && school.subjects.length > 0) {
        return school.subjects.filter(Boolean);
    }
    if (Array.isArray(state.subjects) && state.subjects.length > 0) {
        return state.subjects.filter(Boolean);
    }
    return DEFAULT_SUBJECTS;
};

export const setSchoolSubjects = (state: AppState, schoolId: string | undefined, subjects: string[]) => {
    if (schoolId) {
        const school = getSchool(state, schoolId);
        if (school) {
            school.subjects = subjects;
        }
    }
    state.subjects = subjects;
};

export const getSchoolClassKey = (schoolId: string | undefined, classKey: string): string => {
    if (!classKey) return '';
    const pureKey = classKey.includes('__') ? classKey.split('__').pop() || classKey : classKey;
    if (schoolId) return `${schoolId}__${pureKey}`;
    return pureKey;
};

export const getSchoolClassSchedule = (state: AppState, schoolId: string | undefined, classKey: string): Record<string, ScheduleDay> => {
    if (!state.schedules || !classKey) return {};
    const pureKey = classKey.includes('__') ? classKey.split('__').pop() || classKey : classKey;
    if (schoolId) {
        const scopedKey = `${schoolId}__${pureKey}`;
        return state.schedules[scopedKey] || {};
    }
    return state.schedules[pureKey] || {};
};

export const setSchoolClassSchedule = (state: AppState, schoolId: string | undefined, classKey: string, schedule: Record<string, ScheduleDay>): void => {
    if (!state.schedules) state.schedules = {};
    const targetKey = getSchoolClassKey(schoolId, classKey);
    state.schedules[targetKey] = schedule;
};

export const getSchoolClassGrades = (state: AppState, schoolId: string | undefined, classKey: string): Record<string, Grade[]> => {
    if (!state.grades || !classKey) return {};
    const pureKey = classKey.includes('__') ? classKey.split('__').pop() || classKey : classKey;
    if (schoolId) {
        const scopedKey = `${schoolId}__${pureKey}`;
        return state.grades[scopedKey] || {};
    }
    return state.grades[pureKey] || {};
};

export const setSchoolClassGrades = (state: AppState, schoolId: string | undefined, classKey: string, grades: Record<string, Grade[]>): void => {
    if (!state.grades) state.grades = {};
    const targetKey = getSchoolClassKey(schoolId, classKey);
    state.grades[targetKey] = grades;
};

export const getSchoolClassFinalGrades = (state: AppState, schoolId: string | undefined, classKey: string): Record<string, FinalGradeEntry[]> => {
    if (!state.finalGrades || !classKey) return {};
    const pureKey = classKey.includes('__') ? classKey.split('__').pop() || classKey : classKey;
    if (schoolId) {
        const scopedKey = `${schoolId}__${pureKey}`;
        return state.finalGrades[scopedKey] || {};
    }
    return state.finalGrades[pureKey] || {};
};

export const setSchoolClassFinalGrades = (state: AppState, schoolId: string | undefined, classKey: string, finalGrades: Record<string, FinalGradeEntry[]>): void => {
    if (!state.finalGrades) state.finalGrades = {};
    const targetKey = getSchoolClassKey(schoolId, classKey);
    state.finalGrades[targetKey] = finalGrades;
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
            return author?.schoolId === schoolId;
        });
    }
    if (classKey) {
        const parts = classKey.split('_');
        const cNum = parts[0];
        const cLet = parts[1];
        list = list.filter(h => h.class === cNum && (!cLet || h.letter === cLet));
    }
    return list;
};

export const getSchoolTeacherAssignments = (state: AppState, schoolId?: string): TeacherAssignment[] => {
    if (!state.teacherAssignments) return [];
    if (!schoolId) return state.teacherAssignments;
    return state.teacherAssignments.filter(a => {
        if (a.schoolId) return a.schoolId === schoolId;
        const teacher = state.users.find(u => u.id === a.teacherId);
        return teacher?.schoolId === schoolId;
    });
};

export const getSchoolStudentGroups = (state: AppState, schoolId?: string, classKey?: string): StudentGroup[] => {
    if (!state.studentGroups) return [];
    let list = state.studentGroups;
    if (schoolId) {
        list = list.filter(g => {
            if (g.schoolId) return g.schoolId === schoolId;
            const firstStudent = state.users.find(u => g.studentIds.includes(u.id));
            return firstStudent ? firstStudent.schoolId === schoolId : true;
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
            delete state.grades[pureKey];
        }
        if (state.finalGrades) {
            delete state.finalGrades[scopedKey];
            delete state.finalGrades[pureKey];
        }
    });
};



