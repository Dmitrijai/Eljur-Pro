
import React, { useEffect, useState, useRef } from 'react';
import * as DB from './services/db';
import { AppState, User, School, COEFFICIENT_TYPES } from './types';
import Login from './views/Login';
import DirectorDashboard from './views/DirectorDashboard';
import TeacherDashboard from './views/TeacherDashboard';
import StudentDashboard from './views/StudentDashboard';
import CreatorDashboard from './views/CreatorDashboard';
import EmployeeDashboard from './views/EmployeeDashboard';
import Settings from './views/Settings';
import { Settings as SettingsIcon, LogOut, Menu, GraduationCap, ExternalLink, Copy, Check } from 'lucide-react';
import * as H from './utils/helpers';
import { Modal, Button } from './components/ui';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import DOMPurify from 'dompurify';

const INITIAL_Q1_DATES = [
  '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23',
  '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30',
  '2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06'
];

const INITIAL_Q2_DATES = [
  '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'
];

const INITIAL_SCHEDULE_SETTINGS = {
  daysToAddBatch: 1,
  skippedWeekDays: [0, 6],
  holidays: [
    { id: 'hol_unity', date: '2026-11-04', title: 'День народного единства' }
  ],
  vacations: [
    { id: 'vac_autumn', title: 'Осенние каникулы', start: '2026-11-16', end: '2026-11-22' }
  ],
  quarterDefinitions: {
    'Q1': { start: '2026-09-01', end: '2026-11-15' },
    'Q2': { start: '2026-11-23', end: '2026-12-30' },
    'Q3': { start: '2027-01-11', end: '2027-03-25' },
    'Q4': { start: '2027-04-01', end: '2027-05-31' }
  }
};

const build10AScheduleDays = () => {
  const days: Record<string, any> = {};
  const dates = [
    // Previous week (Q1)
    { date: '2026-10-19', dow: 1 },
    { date: '2026-10-20', dow: 2 },
    { date: '2026-10-21', dow: 3 },
    { date: '2026-10-22', dow: 4 },
    { date: '2026-10-23', dow: 5 },
    // Current week (Q1)
    { date: '2026-10-26', dow: 1 },
    { date: '2026-10-27', dow: 2 },
    { date: '2026-10-28', dow: 3 },
    { date: '2026-10-29', dow: 4 },
    { date: '2026-10-30', dow: 5 },
    // Next week (Q1)
    { date: '2026-11-02', dow: 1 },
    { date: '2026-11-03', dow: 2 },
    { date: '2026-11-05', dow: 4 },
    { date: '2026-11-06', dow: 5 },
    // First week of Q2
    { date: '2026-11-23', dow: 1 },
    { date: '2026-11-24', dow: 2 },
    { date: '2026-11-25', dow: 3 },
    { date: '2026-11-26', dow: 4 },
    { date: '2026-11-27', dow: 5 }
  ];

  const templates: Record<number, { timeRange: string; lesson: string; teacherId: string; room: string }[]> = {
    1: [
      { timeRange: '08:30 - 09:15', lesson: 'Математика', teacherId: 'u_teacher', room: '301' },
      { timeRange: '09:25 - 10:10', lesson: 'Физика', teacherId: 'u_teacher', room: '305' },
      { timeRange: '10:30 - 11:15', lesson: 'Русский язык', teacherId: 'u_s1_t2', room: '204' },
      { timeRange: '11:35 - 12:20', lesson: 'Информатика', teacherId: 'u_s1_t3', room: '402' },
      { timeRange: '12:30 - 13:15', lesson: 'Английский язык', teacherId: 'u_s1_t2', room: '208' },
      { timeRange: '13:25 - 14:10', lesson: 'История', teacherId: 'u_s1_t3', room: '210' }
    ],
    2: [
      { timeRange: '08:30 - 09:15', lesson: 'Физика', teacherId: 'u_teacher', room: '305' },
      { timeRange: '09:25 - 10:10', lesson: 'Математика', teacherId: 'u_teacher', room: '301' },
      { timeRange: '10:30 - 11:15', lesson: 'Литература', teacherId: 'u_s1_t2', room: '204' },
      { timeRange: '11:35 - 12:20', lesson: 'Химия', teacherId: 'u_s1_t3', room: '310' },
      { timeRange: '12:30 - 13:15', lesson: 'Физкультура', teacherId: 'u_s1_t3', room: 'Спортзал' }
    ],
    3: [
      { timeRange: '08:30 - 09:15', lesson: 'Математика', teacherId: 'u_teacher', room: '301' },
      { timeRange: '09:25 - 10:10', lesson: 'Русский язык', teacherId: 'u_s1_t2', room: '204' },
      { timeRange: '10:30 - 11:15', lesson: 'Физика', teacherId: 'u_teacher', room: '305' },
      { timeRange: '11:35 - 12:20', lesson: 'Информатика', teacherId: 'u_s1_t3', room: '402' },
      { timeRange: '12:30 - 13:15', lesson: 'Биология', teacherId: 'u_s1_t3', room: '308' }
    ],
    4: [
      { timeRange: '08:30 - 09:15', lesson: 'Физика', teacherId: 'u_teacher', room: '305' },
      { timeRange: '09:25 - 10:10', lesson: 'Математика', teacherId: 'u_teacher', room: '301' },
      { timeRange: '10:30 - 11:15', lesson: 'Английский язык', teacherId: 'u_s1_t2', room: '208' },
      { timeRange: '11:35 - 12:20', lesson: 'Литература', teacherId: 'u_s1_t2', room: '204' },
      { timeRange: '12:30 - 13:15', lesson: 'География', teacherId: 'u_s1_t3', room: '212' }
    ],
    5: [
      { timeRange: '08:30 - 09:15', lesson: 'Математика', teacherId: 'u_teacher', room: '301' },
      { timeRange: '09:25 - 10:10', lesson: 'Физика', teacherId: 'u_teacher', room: '305' },
      { timeRange: '10:30 - 11:15', lesson: 'Информатика', teacherId: 'u_s1_t3', room: '402' },
      { timeRange: '11:35 - 12:20', lesson: 'История', teacherId: 'u_s1_t3', room: '210' },
      { timeRange: '12:30 - 13:15', lesson: 'Русский язык', teacherId: 'u_s1_t2', room: '204' }
    ]
  };

  dates.forEach(({ date, dow }) => {
    const id = `day_10a_${date}`;
    const rows = templates[dow] || templates[1];
    days[id] = {
      id,
      date,
      title: H.getDayOfWeek(date, 'ru'),
      lessons: rows.map((r, idx) => ({
        id: `l_10a_${date}_${idx + 1}`,
        timeRange: r.timeRange,
        lesson: r.lesson,
        teacherId: r.teacherId,
        room: r.room,
        canGrade: true
      }))
    };
  });
  return days;
};

const INITIAL_10A_DAYS = build10AScheduleDays();

const INITIAL_10A_GRADES: Record<string, any[]> = {
  'Математика': [
    { id: 'g_m_1', studentId: 's_1', subject: 'Математика', value: '5', date: '2026-10-19', type: 'otv', weight: 1, comment: 'Отличное решение у доски (формулы двойного угла)', lessonIndex: 0 },
    { id: 'g_m_2', studentId: 's_1', subject: 'Математика', value: '5', date: '2026-10-21', type: 'sr', weight: 3, comment: 'Самостоятельная работа: тригонометрические уравнения', lessonIndex: 0 },
    { id: 'g_m_3', studentId: 's_1', subject: 'Математика', value: '4', date: '2026-10-23', type: 'dz', weight: 1, comment: 'Домашняя работа: 1 недочет в ОДЗ', lessonIndex: 0 },
    { id: 'g_m_4', studentId: 's_1', subject: 'Математика', value: '5', date: '2026-10-26', type: 'kr', weight: 5, comment: 'Контрольная работа №2 — блестяще, решена задача со звездочкой!', lessonIndex: 0 },
    { id: 'g_m_5', studentId: 's_1', subject: 'Математика', value: '5', date: '2026-10-28', type: 'otv', weight: 1, comment: 'Устный ответ: формулы приведения', lessonIndex: 0 },
    { id: 'g_m_6', studentId: 's_1', subject: 'Математика', value: '5', date: '2026-10-30', type: 'pr', weight: 2, comment: 'Практикум по тригонометрическим неравенствам', lessonIndex: 0 },

    { id: 'g_m_7', studentId: 'u_s1_s2', subject: 'Математика', value: '5', date: '2026-10-19', type: 'otv', weight: 1, comment: 'Молодец, быстрое решение', lessonIndex: 0 },
    { id: 'g_m_8', studentId: 'u_s1_s2', subject: 'Математика', value: '5', date: '2026-10-21', type: 'sr', weight: 3, comment: 'Самостоятельная работа без ошибок', lessonIndex: 0 },
    { id: 'g_m_9', studentId: 'u_s1_s2', subject: 'Математика', value: '4', date: '2026-10-26', type: 'kr', weight: 5, comment: 'Контрольная работа №2: вычислительная погрешность в №4', lessonIndex: 0 },
    { id: 'g_m_10', studentId: 'u_s1_s2', subject: 'Математика', value: '5', date: '2026-10-29', type: 'dz', weight: 1, comment: 'Домашняя работа выполнена образцово', lessonIndex: 0 },
    { id: 'g_m_10b', studentId: 'u_s1_s2', subject: 'Математика', value: 'ОП', date: '2026-10-30', type: 'op', weight: 0, comment: 'Опоздание на 5 минут', lessonIndex: 0 },

    { id: 'g_m_11', studentId: 'u_s1_s3', subject: 'Математика', value: '4', date: '2026-10-19', type: 'otv', weight: 1, comment: 'Хороший ответ у доски', lessonIndex: 0 },
    { id: 'g_m_12', studentId: 'u_s1_s3', subject: 'Математика', value: '3', date: '2026-10-21', type: 'sr', weight: 3, comment: 'Самостоятельная работа (вариант 2): повторить арккосинус', lessonIndex: 0 },
    { id: 'g_m_13', studentId: 'u_s1_s3', subject: 'Математика', value: '4', date: '2026-10-26', type: 'kr', weight: 5, comment: 'Контрольная работа №2 — твердая четверка', lessonIndex: 0 },
    { id: 'g_m_14', studentId: 'u_s1_s3', subject: 'Математика', value: 'Н/У', date: '2026-10-28', type: 'nu', weight: 2, deadline: '2026-11-10', comment: 'Не сдал домашнюю тетрадь — донести до 10.11.2026', lessonIndex: 0 },
    { id: 'g_m_14b', studentId: 'u_s1_s3', subject: 'Математика', value: '5', date: '2026-10-30', type: 'otv', weight: 1, comment: 'Успешно разобрал тему у доски', lessonIndex: 0 },

    { id: 'g_m_15', studentId: 'u_s1_s4', subject: 'Математика', value: '5', date: '2026-10-20', type: 'dz', weight: 1, comment: 'Аккуратное решение ДЗ', lessonIndex: 0 },
    { id: 'g_m_16', studentId: 'u_s1_s4', subject: 'Математика', value: '4', date: '2026-10-21', type: 'sr', weight: 3, comment: 'Самостоятельная работа', lessonIndex: 0 },
    { id: 'g_m_16b', studentId: 'u_s1_s4', subject: 'Математика', value: 'Н', date: '2026-10-23', type: 'n', weight: 0, comment: 'Справка от врача (участие в сборах)', lessonIndex: 0 },
    { id: 'g_m_17', studentId: 'u_s1_s4', subject: 'Математика', value: '4', date: '2026-10-26', type: 'kr', weight: 5, comment: 'Контрольная работа №2', lessonIndex: 0 },
    { id: 'g_m_18', studentId: 'u_s1_s4', subject: 'Математика', value: '5', date: '2026-10-29', type: 'otv', weight: 1, comment: 'Блиц-опрос по тригонометрии', lessonIndex: 0 }
  ],
  'Физика': [
    { id: 'g_p_1', studentId: 's_1', subject: 'Физика', value: '5', date: '2026-10-19', type: 'pr', weight: 2, comment: 'Лабораторная работа №3: Законы Ньютона', lessonIndex: 0 },
    { id: 'g_p_2', studentId: 's_1', subject: 'Физика', value: '5', date: '2026-10-22', type: 'sr', weight: 3, comment: 'Самостоятельная: движение по наклонной плоскости', lessonIndex: 0 },
    { id: 'g_p_3', studentId: 's_1', subject: 'Физика', value: '5', date: '2026-10-27', type: 'kr', weight: 5, comment: 'Контрольная работа: Динамика материальной точки', lessonIndex: 0 },
    { id: 'g_p_4', studentId: 's_1', subject: 'Физика', value: '5', date: '2026-10-30', type: 'otv', weight: 1, comment: 'Закон сохранения импульса — разбор олимпиадной задачи', lessonIndex: 0 },

    { id: 'g_p_5', studentId: 'u_s1_s2', subject: 'Физика', value: '4', date: '2026-10-19', type: 'pr', weight: 2, comment: 'Лабораторная №3: погрешность измерений', lessonIndex: 0 },
    { id: 'g_p_6', studentId: 'u_s1_s2', subject: 'Физика', value: '4', date: '2026-10-22', type: 'sr', weight: 3, comment: 'Самостоятельная работа', lessonIndex: 0 },
    { id: 'g_p_6b', studentId: 'u_s1_s2', subject: 'Физика', value: '5', date: '2026-10-27', type: 'kr', weight: 5, comment: 'Контрольная работа выполнена отлично', lessonIndex: 0 },

    { id: 'g_p_7', studentId: 'u_s1_s3', subject: 'Физика', value: '4', date: '2026-10-20', type: 'otv', weight: 1, comment: 'Сила упругости и закон Гука', lessonIndex: 0 },
    { id: 'g_p_7b', studentId: 'u_s1_s3', subject: 'Физика', value: '3', date: '2026-10-22', type: 'sr', weight: 3, comment: 'Проекции сил на оси координат', lessonIndex: 0 },
    { id: 'g_p_8', studentId: 'u_s1_s3', subject: 'Физика', value: '4', date: '2026-10-27', type: 'kr', weight: 5, comment: 'Контрольная по динамике', lessonIndex: 0 },
    { id: 'g_p_8b', studentId: 'u_s1_s3', subject: 'Физика', value: 'Н/У', date: '2026-10-29', type: 'nu', weight: 2, deadline: '2026-11-12', comment: 'Сдать защиту лабораторной работы №3 до 12.11.2026', lessonIndex: 0 },

    { id: 'g_p_9', studentId: 'u_s1_s4', subject: 'Физика', value: '5', date: '2026-10-22', type: 'sr', weight: 3, comment: 'Задача повышенной сложности', lessonIndex: 0 },
    { id: 'g_p_10', studentId: 'u_s1_s4', subject: 'Физика', value: '5', date: '2026-10-27', type: 'kr', weight: 5, comment: 'Контрольная работа без замечаний', lessonIndex: 0 },
    { id: 'g_p_10b', studentId: 'u_s1_s4', subject: 'Физика', value: '4', date: '2026-10-30', type: 'dz', weight: 1, comment: 'Домашнее задание по импульсу тела', lessonIndex: 0 }
  ],
  'Русский язык': [
    { id: 'g_r_1', studentId: 's_1', subject: 'Русский язык', value: '4', date: '2026-10-19', type: 'sr', weight: 3, comment: 'Словарный диктант', lessonIndex: 0 },
    { id: 'g_r_2', studentId: 's_1', subject: 'Русский язык', value: '4', date: '2026-10-26', type: 'kr', weight: 5, comment: 'Сочинение-рассуждение', lessonIndex: 0 },
    { id: 'g_r_3', studentId: 'u_s1_s2', subject: 'Русский язык', value: '5', date: '2026-10-19', type: 'sr', weight: 3, comment: 'Безукоризненный диктант', lessonIndex: 0 },
    { id: 'g_r_4', studentId: 'u_s1_s2', subject: 'Русский язык', value: '5', date: '2026-10-26', type: 'kr', weight: 5, comment: 'Глубокий анализ текста', lessonIndex: 0 },
    { id: 'g_r_5', studentId: 'u_s1_s3', subject: 'Русский язык', value: '4', date: '2026-10-21', type: 'dz', weight: 1, comment: 'Упражнение 178', lessonIndex: 0 },
    { id: 'g_r_6', studentId: 'u_s1_s4', subject: 'Русский язык', value: '5', date: '2026-10-26', type: 'kr', weight: 5, comment: 'Отличное сочинение', lessonIndex: 0 }
  ],
  'Информатика': [
    { id: 'g_i_1', studentId: 's_1', subject: 'Информатика', value: '5', date: '2026-10-21', type: 'pr', weight: 2, comment: 'Алгоритмы быстрой сортировки Python', lessonIndex: 0 },
    { id: 'g_i_2', studentId: 's_1', subject: 'Информатика', value: '5', date: '2026-10-28', type: 'kr', weight: 5, comment: 'Структуры данных и графы', lessonIndex: 0 },
    { id: 'g_i_3', studentId: 'u_s1_s2', subject: 'Информатика', value: '4', date: '2026-10-28', type: 'kr', weight: 5, comment: 'Контрольная работа по графам', lessonIndex: 0 },
    { id: 'g_i_4', studentId: 'u_s1_s3', subject: 'Информатика', value: '5', date: '2026-10-28', type: 'kr', weight: 5, comment: 'Олимпиадное решение на C++', lessonIndex: 0 },
    { id: 'g_i_5', studentId: 'u_s1_s4', subject: 'Информатика', value: '4', date: '2026-10-21', type: 'pr', weight: 2, comment: 'Практическая работа', lessonIndex: 0 }
  ],
  'Химия': [
    { id: 'g_ch_1', studentId: 's_1', subject: 'Химия', value: '4', date: '2026-10-20', type: 'sr', weight: 3, comment: 'Углеводороды', lessonIndex: 0 },
    { id: 'g_ch_2', studentId: 'u_s1_s2', subject: 'Химия', value: '5', date: '2026-10-20', type: 'sr', weight: 3, comment: 'Цепочки превращений алканов', lessonIndex: 0 },
    { id: 'g_ch_3', studentId: 'u_s1_s4', subject: 'Химия', value: '5', date: '2026-10-27', type: 'kr', weight: 5, comment: 'Лучшая контрольная работа по органической химии', lessonIndex: 0 }
  ],
  'Биология': [
    { id: 'g_bio_1', studentId: 's_1', subject: 'Биология', value: '4', date: '2026-10-21', type: 'otv', weight: 1, comment: 'Клеточный метаболизм', lessonIndex: 0 },
    { id: 'g_bio_2', studentId: 'u_s1_s2', subject: 'Биология', value: '5', date: '2026-10-28', type: 'sr', weight: 3, comment: 'Синтез белка', lessonIndex: 0 },
    { id: 'g_bio_3', studentId: 'u_s1_s4', subject: 'Биология', value: '5', date: '2026-10-28', type: 'kr', weight: 5, comment: 'Генетика и цитология — отлично', lessonIndex: 0 }
  ],
  'История': [
    { id: 'g_hist_1', studentId: 's_1', subject: 'История', value: '4', date: '2026-10-23', type: 'otv', weight: 1, comment: 'Реформы начала XX века', lessonIndex: 0 },
    { id: 'g_hist_2', studentId: 'u_s1_s2', subject: 'История', value: '5', date: '2026-10-26', type: 'kr', weight: 5, comment: 'Историческое эссе', lessonIndex: 0 },
    { id: 'g_hist_3', studentId: 'u_s1_s3', subject: 'История', value: '5', date: '2026-10-26', type: 'kr', weight: 5, comment: 'Отличное знание хронологии', lessonIndex: 0 }
  ],
  'Английский язык': [
    { id: 'g_eng_1', studentId: 's_1', subject: 'Английский язык', value: '4', date: '2026-10-22', type: 'sr', weight: 3, comment: 'Grammar Test: Conditionals', lessonIndex: 0 },
    { id: 'g_eng_2', studentId: 'u_s1_s2', subject: 'Английский язык', value: '5', date: '2026-10-22', type: 'sr', weight: 3, comment: 'Speaking & Essay', lessonIndex: 0 },
    { id: 'g_eng_3', studentId: 'u_s1_s4', subject: 'Английский язык', value: '5', date: '2026-10-29', type: 'kr', weight: 5, comment: 'Reading Comprehension', lessonIndex: 0 }
  ],
  'Литература': [
    { id: 'g_lit_1', studentId: 's_1', subject: 'Литература', value: '4', date: '2026-10-20', type: 'otv', weight: 1, comment: 'Анализ образа Обломова', lessonIndex: 0 },
    { id: 'g_lit_2', studentId: 'u_s1_s2', subject: 'Литература', value: '5', date: '2026-10-27', type: 'kr', weight: 5, comment: 'Сочинение по роману И.А. Гончарова', lessonIndex: 0 },
    { id: 'g_lit_3', studentId: 'u_s1_s3', subject: 'Литература', value: '4', date: '2026-10-27', type: 'kr', weight: 5, comment: 'Хорошее сочинение', lessonIndex: 0 }
  ],
  'География': [
    { id: 'g_geo_1', studentId: 's_1', subject: 'География', value: '5', date: '2026-10-22', type: 'pr', weight: 2, comment: 'Контурные карты мирового хозяйства', lessonIndex: 0 },
    { id: 'g_geo_2', studentId: 'u_s1_s3', subject: 'География', value: '5', date: '2026-10-29', type: 'sr', weight: 3, comment: 'Экономическая география', lessonIndex: 0 }
  ],
  'Физкультура': [
    { id: 'g_pe_1', studentId: 's_1', subject: 'Физкультура', value: '5', date: '2026-10-20', type: 'pr', weight: 2, comment: 'Норматив 100 м', lessonIndex: 0 },
    { id: 'g_pe_2', studentId: 'u_s1_s3', subject: 'Физкультура', value: '5', date: '2026-10-27', type: 'pr', weight: 2, comment: 'Подтягивания — рекорд класса', lessonIndex: 0 }
  ]
};

const defaultSchool: School = {
  id: 'school_1',
  name: 'Гимназия №1 им. А.С. Пушкина',
  directorId: 'u_dir',
  classes: [
    { class: '10', letter: 'А', headmasterId: 'u_teacher' },
    { class: '9', letter: 'А', headmasterId: 'u_s1_t2' }
  ],
  subjects: [
    'Математика', 'Русский язык', 'Физика', 'Литература', 'История',
    'Химия', 'Биология', 'География', 'Английский язык', 'Физкультура', 'Информатика'
  ],
  quarters: {
    Q1: INITIAL_Q1_DATES,
    Q2: INITIAL_Q2_DATES,
    Q3: [],
    Q4: []
  },
  scheduleSettings: INITIAL_SCHEDULE_SETTINGS,
  eljurInfo: H.DEFAULT_ELJUR_INFO_HTML,
  schoolInfo: H.DEFAULT_SCHOOL_1_INFO_HTML
};

export const defaultState: AppState = {
  schools: [defaultSchool],
  users: [
    { id: 'u_creator', schoolId: 'global', fio: 'Создатель', role: 'creator', login: 'creator', password: 'admin123' },
    { id: 'u_dir', schoolId: 'school_1', fio: 'Иванов Иван', role: 'director', login: 'director', password: 'dir123' },
    { id: 'u_teacher', schoolId: 'school_1', fio: 'Петров Пётр', role: 'teacher', login: 'teacher', password: 'teach123', subjects: ['Математика', 'Физика'], classes: ['10_А'] },
    { id: 'u_s1_t2', schoolId: 'school_1', fio: 'Смирнова Елена Викторовна', role: 'teacher', login: 'smirnova_ev', password: 'teach123_2', subjects: ['Русский язык', 'Литература', 'Английский язык'], classes: ['10_А', '9_А'] },
    { id: 'u_s1_t3', schoolId: 'school_1', fio: 'Морозов Андрей Сергеевич', role: 'teacher', login: 'morozov_as', password: 'teach123_3', subjects: ['Информатика', 'История', 'Химия', 'Биология', 'География', 'Физкультура'], classes: ['10_А', '9_А'] },
    { id: 'u_emp', schoolId: 'school_1', fio: 'Сидоров Сидр', role: 'employee', customRole: 'Заместитель директора по УВР', login: 'emp', password: 'emp123', employeePermissions: { allowedTabs: ['messages', 'rating', 'schedule', 'announcements', 'users'], isAdministration: true, canSendAsDirector: true, messagingScope: ['ALL'] } },
    { id: 's_1', schoolId: 'school_1', fio: 'Кузнецов Алексей', role: 'student', login: 's10a_1', password: 'pass123', class: '10', letter: 'А' },
    { id: 'u_s1_s2', schoolId: 'school_1', fio: 'Соколова Мария Александровна', role: 'student', login: 's10a_2', password: 'pass123_2', class: '10', letter: 'А' },
    { id: 'u_s1_s3', schoolId: 'school_1', fio: 'Попов Дмитрий Игоревич', role: 'student', login: 's10a_3', password: 'pass123_3', class: '10', letter: 'А' },
    { id: 'u_s1_s4', schoolId: 'school_1', fio: 'Лебедева Анна Денисовна', role: 'student', login: 's10a_4', password: 'pass123_4', class: '10', letter: 'А' }
  ],
  userOrder: ['u_dir', 'u_teacher', 'u_s1_t2', 'u_s1_t3', 'u_emp', 's_1', 'u_s1_s2', 'u_s1_s3', 'u_s1_s4'],
  classes: [
    { class: '10', letter: 'А', headmasterId: 'u_teacher' },
    { class: '9', letter: 'А', headmasterId: 'u_s1_t2' }
  ],
  subjects: [
    'Математика', 'Русский язык', 'Физика', 'Литература', 'История',
    'Химия', 'Биология', 'География', 'Английский язык', 'Физкультура', 'Информатика'
  ],
  schedules: {
    '10_А': INITIAL_10A_DAYS,
    'school_1__10_А': INITIAL_10A_DAYS
  },
  homework: [
    {
      id: 'hw_math_1',
      schoolId: 'school_1',
      fromId: 'u_teacher',
      class: '10',
      letter: 'А',
      subject: 'Математика',
      text: 'Тригонометрические уравнения и формулы приведения: решить № 412, 415 (а, б) из учебника, а также выполнить тренировочный вариант из прикрепленного файла.',
      date: '2026-10-28',
      lessonIndex: 0,
      attachments: [
        { id: 'att_hw_math_10a', name: 'Вариант_подготовки_Тригонометрия_10А.txt', type: 'text/plain;charset=utf-8' }
      ]
    },
    {
      id: 'hw_phys_1',
      schoolId: 'school_1',
      fromId: 'u_teacher',
      class: '10',
      letter: 'А',
      subject: 'Физика',
      text: 'Законы Ньютона и движение связанных тел: повторить § 18–20, оформить решение двух задач из прикрепленного лабораторного практикума в рабочей тетради.',
      date: '2026-10-29',
      lessonIndex: 0,
      attachments: [
        { id: 'att_hw_phys_10a', name: 'Лабораторный_практикум_Динамика_10А.txt', type: 'text/plain;charset=utf-8' }
      ]
    },
    {
      id: 'hw_math_2',
      schoolId: 'school_1',
      fromId: 'u_teacher',
      class: '10',
      letter: 'А',
      subject: 'Математика',
      text: 'Подготовка к зачету по тригонометрическим тождествам: выполнить итоговый блок упражнений № 425–428, повторить таблицу значений тригонометрических функций.',
      date: '2026-11-02',
      lessonIndex: 0
    },
    {
      id: 'hw_rus_1',
      schoolId: 'school_1',
      fromId: 'u_s1_t2',
      class: '10',
      letter: 'А',
      subject: 'Русский язык',
      text: 'Правописание Н и НН в различных частях речи: упражнение 184 (письменно), составить 10 словосочетаний со страдательными причастиями прошедшего времени.',
      date: '2026-10-30',
      lessonIndex: 0
    }
  ],
  messages: [
    {
      id: 'msg_dir_to_creator_1',
      schoolId: 'school_1',
      fromId: 'u_dir',
      toIds: ['u_creator'],
      title: 'Отчет о внедрении ЭлЖур и сводная ведомость за I четверть',
      body: 'Уважаемый Создатель платформы «ЭлЖур»!\n\nНаправляю Вам официальный отчет Гимназии №1 им. А.С. Пушкина по итогам работы в системе за октябрь 2026 года, а также копию приказа № 42-ОД о проведении промежуточной аттестации.\n\nВсе учителя (Петров П.П., Смирнова Е.В., Морозов А.С.) полностью перешли на электронный журнал, расписание и домашние задания синхронизируются мгновенно. Во вложении прикреплены отчет и подписанный приказ.',
      date: '2026-10-30T10:15:00.000Z',
      read: false,
      readBy: [],
      attachments: [
        { id: 'att_dir_report_1', name: 'Отчет_директора_Иванова_ИИ_I_четверть.txt', type: 'text/plain;charset=utf-8' },
        { id: 'att_dir_order_1', name: 'Приказ_№42_О_проведении_аттестации.svg', type: 'image/svg+xml;charset=utf-8' }
      ]
    },
    {
      id: 'msg_creator_to_dir_1',
      schoolId: 'school_1',
      fromId: 'u_creator',
      toIds: ['u_dir'],
      title: 'Обновление платформы ЭлЖур v7 Release: аудит безопасности и аналитика',
      body: 'Здравствуйте, Иван Иванович!\n\nБлагодарим за предоставленный отчет по Гимназии №1. Сообщаем Вам, что платформа «ЭлЖур» успешно прошла комплексный аудит безопасности:\n1. Внедрена многослойная защита от XSS-скриптов во всех полях ввода и документах.\n2. Обновлена карточка «О системе ЭлЖур» с наглядными иллюстрациями.\n3. Проверена облачная синхронизация вложений и ведомостей успеваемости.\n\nЕсли потребуются дополнительные квоты для новых классов — напишите в ответном сообщении.',
      date: '2026-10-30T11:40:00.000Z',
      read: true,
      readBy: ['u_dir']
    },
    {
      id: 'msg_dir_to_staff_1',
      schoolId: 'school_1',
      fromId: 'u_dir',
      toIds: ['u_teacher', 'u_s1_t2', 'u_s1_t3', 'u_emp'],
      title: 'Приказ об утверждении расписания и регламента выставления оценок за I четверть',
      body: 'Уважаемые коллеги!\n\nНаправляю для руководства в работе утвержденный регламент выставления текущих и контрольных оценок в системе «ЭлЖур», а также приказ № 42-ОД о порядке проведения аттестации за I четверть.\n\nПрошу обратить особое внимание на своевременное заполнение домашних заданий и контроль закрытия задолженностей «Н/У». Файлы регламента и приказа прикреплены к настоящему письму.',
      date: '2026-10-29T14:20:00.000Z',
      editedAt: '2026-10-30T09:15:00.000Z',
      read: true,
      readBy: ['u_teacher', 'u_emp', 'u_s1_t2'],
      readBeforeEditBy: ['u_teacher', 'u_s1_t2'],
      readAfterEditBy: ['u_teacher', 'u_emp'],
      attachments: [
        { id: 'att_dir_schedule_reg', name: 'Регламент_выставления_оценок_и_весов_ЭлЖур.txt', type: 'text/plain;charset=utf-8' },
        { id: 'att_dir_order_1', name: 'Приказ_№42_О_проведении_аттестации.svg', type: 'image/svg+xml;charset=utf-8' }
      ]
    },
    {
      id: 'msg_dir_to_students_1',
      schoolId: 'school_1',
      fromId: 'u_dir',
      toIds: ['s_1', 'u_s1_s2', 'u_s1_s3', 'u_s1_s4'],
      title: 'Памятка по подготовке к школьному этапу Всероссийской олимпиады и график консультаций',
      body: 'Дорогие ребята!\n\nВ ноябре стартуют профильные туры школьного этапа олимпиады по математике, физике, информатике и русскому языку. Во вложении направляю памятку участника с расписанием аудиторий и консультаций.\n\nЖелаю всем отличных результатов!',
      date: '2026-10-29T15:05:00.000Z',
      read: true,
      readBy: ['s_1', 'u_s1_s2'],
      attachments: [
        { id: 'att_dir_olymp_memo', name: 'График_олимпиад_и_памятка_ученика_10А.txt', type: 'text/plain;charset=utf-8' }
      ]
    },
    {
      id: 'msg_teacher_to_dir_1',
      schoolId: 'school_1',
      fromId: 'u_teacher',
      toIds: ['u_dir'],
      title: 'Докладная записка: успеваемость 10-А класса по математике и физике',
      body: 'Уважаемый Иван Иванович!\n\nДокладываю, что в 10-А классе проведены контрольные работы по математике и физике. Средний балл класса составляет 4.78, неуспевающих нет, выставленные типы работ (КР, СР, ДЗ, Ответ, Практика, Н/У со сроком сдачи) и предварительные оценки за I четверть внесены в электронный журнал.',
      date: '2026-10-30T16:10:00.000Z',
      read: false,
      readBy: []
    },
    {
      id: 'msg_emp_to_dir_1',
      schoolId: 'school_1',
      fromId: 'u_emp',
      toIds: ['u_dir'],
      title: 'Готовность расписания кабинетов и дежурств на ноябрь 2026',
      body: 'Иван Иванович, расписание уроков на первую неделю ноября проверено на отсутствие конфликтов кабинетов и учителей. Праздничный день 4 ноября (День народного единства) отмечен в календаре учебной части.',
      date: '2026-10-30T17:25:00.000Z',
      read: false,
      readBy: []
    },
    {
      id: 'msg_student_to_dir_1',
      schoolId: 'school_1',
      fromId: 's_1',
      toIds: ['u_dir'],
      title: 'Заявка команды 10-А класса на участие в городском турнире юных физиков',
      body: 'Здравствуйте, Иван Иванович! Спасибо за памятку по олимпиадам. Наш 10-А класс под руководством Петра Петровича сформировал команду из 4 человек для участия в городском турнире по физике. Просим согласовать заявку от Гимназии №1.',
      date: '2026-10-30T18:00:00.000Z',
      read: false,
      readBy: []
    }
  ],
  announcements: [
    {
      id: 'ann_s1_1',
      schoolId: 'school_1',
      fromId: 'u_dir',
      toIds: [],
      title: 'График окончания I учебной четверти и осенних каникул',
      body: 'Уважаемые учителя, сотрудники и учащиеся Гимназии №1 им. А.С. Пушкина!\n\nI учебная четверть завершается 15 ноября 2026 года. Осенние каникулы пройдут с 16 по 22 ноября 2026 года, начало II четверти — 23 ноября 2026 года. Подробный приказ и регламент аттестации прикреплены ниже.',
      date: '2026-10-28T09:00:00.000Z',
      editedAt: '2026-10-29T12:30:00.000Z',
      read: true,
      readBy: ['u_teacher', 'u_emp', 's_1', 'u_s1_s2', 'u_s1_s3'],
      readBeforeEditBy: ['u_teacher', 's_1', 'u_s1_s3'],
      readAfterEditBy: ['u_teacher', 'u_emp', 's_1', 'u_s1_s2'],
      attachments: [
        { id: 'att_dir_order_1', name: 'Приказ_№42_О_проведении_аттестации.svg', type: 'image/svg+xml;charset=utf-8' }
      ]
    }
  ],
  grades: {
    '10_А': INITIAL_10A_GRADES,
    'school_1__10_А': INITIAL_10A_GRADES
  },
  finalGrades: {
    '10_А': {
      'Математика': [
        { studentId: 's_1', q1: '5', isQ1Confirmed: true },
        { studentId: 'u_s1_s2', q1: '5', isQ1Confirmed: true },
        { studentId: 'u_s1_s3', q1: '4', isQ1Confirmed: true },
        { studentId: 'u_s1_s4', q1: '5', isQ1Confirmed: true }
      ],
      'Физика': [
        { studentId: 's_1', q1: '5', isQ1Confirmed: true },
        { studentId: 'u_s1_s2', q1: '5', isQ1Confirmed: true },
        { studentId: 'u_s1_s3', q1: '4', isQ1Confirmed: true },
        { studentId: 'u_s1_s4', q1: '5', isQ1Confirmed: true }
      ]
    },
    'school_1__10_А': {
      'Математика': [
        { studentId: 's_1', q1: '5', isQ1Confirmed: true },
        { studentId: 'u_s1_s2', q1: '5', isQ1Confirmed: true },
        { studentId: 'u_s1_s3', q1: '4', isQ1Confirmed: true },
        { studentId: 'u_s1_s4', q1: '5', isQ1Confirmed: true }
      ],
      'Физика': [
        { studentId: 's_1', q1: '5', isQ1Confirmed: true },
        { studentId: 'u_s1_s2', q1: '5', isQ1Confirmed: true },
        { studentId: 'u_s1_s3', q1: '4', isQ1Confirmed: true },
        { studentId: 'u_s1_s4', q1: '5', isQ1Confirmed: true }
      ]
    }
  },
  teacherAssignments: [
    { id: 'ta_1', teacherId: 'u_teacher', subject: 'Математика', classId: '10_А', schoolId: 'school_1' },
    { id: 'ta_2', teacherId: 'u_teacher', subject: 'Физика', classId: '10_А', schoolId: 'school_1' },
    { id: 'ta_3', teacherId: 'u_s1_t2', subject: 'Русский язык', classId: '10_А', schoolId: 'school_1' },
    { id: 'ta_4', teacherId: 'u_s1_t2', subject: 'Литература', classId: '10_А', schoolId: 'school_1' },
    { id: 'ta_5', teacherId: 'u_s1_t2', subject: 'Английский язык', classId: '10_А', schoolId: 'school_1' },
    { id: 'ta_6', teacherId: 'u_s1_t3', subject: 'Информатика', classId: '10_А', schoolId: 'school_1' },
    { id: 'ta_7', teacherId: 'u_s1_t3', subject: 'История', classId: '10_А', schoolId: 'school_1' }
  ],
  studentGroups: [],
  gradingSystem: {
      minGrade: 2,
      maxGrade: 5,
      useWeights: true,
      minWeight: 1,
      maxWeight: 10
  },
  gradeTypes: [],
  subjectRequirements: {},
  quarters: { Q1: INITIAL_Q1_DATES, Q2: INITIAL_Q2_DATES, Q3: [], Q4: [] },
  settings: {
    theme: 'light', 
    language: 'ru', 
    showSeasonalAnimations: true,
    secretKey: 'Space',
    secretCount: 4,
    adminPassword: 'admin123',
    adminPasswordHash: '',
    adminPasswordSalt: '',
    eljurInfo: H.DEFAULT_ELJUR_INFO_HTML
  },
  scheduleSettings: INITIAL_SCHEDULE_SETTINGS
};

// Memoized background component to prevent re-renders when inputs change
const SeasonalBackground = React.memo(({ enabled, timeOffset }: { enabled: boolean, timeOffset?: number }) => {
    if (!enabled) return null;

    // Honor prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return null;
    }

    // Use Virtual Time and School Timezone for seasonal effects
    const now = H.getSchoolNow(timeOffset || 0);
    const month = now.getMonth(); // 0-11
    
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const particleCount = isMobile ? 12 : 24;
    
    // Helper for random numbers
    const random = (min: number, max: number) => Math.random() * (max - min) + min;

    // Winter: Dec (11), Jan (0), Feb (1)
    if (month === 11 || month === 0 || month === 1) {
        const snow = Array.from({ length: particleCount }).map((_, i) => ({
            id: i,
            left: `${random(0, 100)}vw`,
            duration: `${random(10, 20)}s`,
            delay: `${random(-20, 0)}s`,
            size: `${random(10, 20)}px`
        }));
        
        return (
            <>
                {snow.map(s => (
                    <div key={`s-${s.id}`} className="season-element season-snowflake" style={{ left: s.left, animationDuration: s.duration, animationDelay: s.delay, fontSize: s.size, willChange: 'transform' }}>❄</div>
                ))}
            </>
        );
    }
    
    // Spring: Mar (2), Apr (3), May (4)
    if (month >= 2 && month <= 4) {
        const petals = Array.from({ length: particleCount }).map((_, i) => ({
            id: i,
            left: `${random(0, 100)}vw`,
            duration: `${random(10, 20)}s`,
            delay: `${random(-20, 0)}s`,
            width: `${random(8, 15)}px`,
            height: `${random(10, 18)}px`
        }));

        return (
            <>
                {petals.map(p => (
                    <div key={`p-${p.id}`} className="season-petal" style={{ left: p.left, animationDuration: p.duration, animationDelay: p.delay, width: p.width, height: p.height, willChange: 'transform' }}></div>
                ))}
            </>
        );
    }

    // Summer: Jun (5), Jul (6), Aug (7)
    if (month >= 5 && month <= 7) {
        const summerElements = Array.from({ length: particleCount }).map((_, i) => ({
            id: i,
            left: `${random(0, 100)}vw`,
            duration: `${random(12, 25)}s`,
            delay: `${random(-20, 0)}s`,
            size: `${random(6, 14)}px`,
            isLeaf: Math.random() > 0.5
        }));

        return (
            <>
                {summerElements.map(p => (
                    <div key={`sum-${p.id}`} className={p.isLeaf ? "season-summer-leaf" : "season-pollen"} style={{ left: p.left, animationDuration: p.duration, animationDelay: p.delay, width: p.size, height: p.size, willChange: 'transform' }}></div>
                ))}
            </>
        );
    }

    // Autumn: Sep (8), Oct (9), Nov (10)
    if (month >= 8 && month <= 10) {
        const colors = [
            ['#fb923c', '#ea580c'], // orange
            ['#fcd34d', '#d97706'], // yellow-orange
            ['#f87171', '#dc2626'], // red
            ['#b45309', '#78350f']  // brown
        ];
        const leaves = Array.from({ length: Math.min(particleCount, 16) }).map((_, i) => {
            const colorPair = colors[Math.floor(random(0, colors.length))];
            return {
                id: i,
                left: `${random(0, 90)}vw`,
                duration: `${random(12, 22)}s`,
                delay: `${random(-15, 0)}s`,
                size: `${random(8, 14)}px`,
                color1: colorPair[0],
                color2: colorPair[1]
            };
        });

        return (
            <>
                {leaves.map(l => (
                    <div key={`la-${l.id}`} className="season-autumn-leaf" style={{ 
                        left: l.left, 
                        animationDuration: l.duration, 
                        animationDelay: l.delay, 
                        width: l.size, 
                        height: l.size,
                        willChange: 'transform',
                        '--leaf-color-1': l.color1,
                        '--leaf-color-2': l.color2
                    } as React.CSSProperties}></div>
                ))}
            </>
        );
    }

    return null;
});

export default function App() {
  const [appState, setAppState] = useState<AppState>(() => {
    const prefs = H.getUserPreferences(null, null);
    const hydratedInitialSchools = defaultState.schools.map(s => {
      try {
        const savedName = localStorage.getItem(`eljur_school_name_${s.id}`);
        if (savedName && savedName.trim()) {
          return { ...s, name: savedName.trim() };
        }
      } catch {}
      return s;
    });
    return {
      ...defaultState,
      schools: hydratedInitialSchools,
      messages: defaultState.messages.map(m => H.applyLocalReadReceipts(m).item),
      announcements: defaultState.announcements.map(a => H.applyLocalReadReceipts(a).item),
      settings: {
        ...defaultState.settings,
        theme: prefs.theme || 'light',
        language: prefs.language || 'ru',
        showSeasonalAnimations: prefs.showSeasonalAnimations !== false,
        bodyFontId: prefs.bodyFontId || undefined,
        headingFontId: prefs.headingFontId || undefined,
      },
    };
  });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = H.useSyncedState<'dashboard' | 'settings'>(
    currentUser ? `eljur_view_mode_${currentUser.id}` : 'eljur_view_mode_guest',
    'dashboard'
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showEljurInfo, setShowEljurInfo] = useState(false);
  const [showEmptyEduResourceModal, setShowEmptyEduResourceModal] = useState(false);
  const [copiedResourceId, setCopiedResourceId] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [customFonts, setCustomFonts] = useState<{name: string, displayName: string}[]>([]);
  const [dbError, setDbError] = useState<string | null>(null);

  const currentUserRef = useRef<User | null>(null);
  currentUserRef.current = currentUser;
  const appStateRef = useRef<AppState>(appState);
  appStateRef.current = appState;
  const cloudSyncedSchoolsRef = useRef<Set<string>>(new Set());

  // Cross-tab synchronization for login/logout and state updates
  useEffect(() => {
    const syncSessionFromStorage = () => {
      const sessionStr = localStorage.getItem('eljur_session');
      if (!sessionStr) {
        if (currentUserRef.current !== null) {
          DB.setCurrentSessionUser(null);
          setCurrentUser(null);
          setShowLogoutConfirm(false);
        }
        return;
      }
      try {
        const session = JSON.parse(sessionStr);
        if (!session || (session.expires && session.expires <= Date.now())) {
          if (currentUserRef.current !== null) {
            DB.setCurrentSessionUser(null);
            setCurrentUser(null);
            setShowLogoutConfirm(false);
          }
          return;
        }
        const targetId = session.userId || session.user?.id;
        if (targetId && currentUserRef.current?.id !== targetId) {
          const foundUser =
            (appStateRef.current?.users || []).find((u: any) => u.id === targetId) ||
            session.user ||
            defaultState.users.find((u: any) => u.id === targetId);
          if (foundUser && (!foundUser.blockedUntil || new Date(foundUser.blockedUntil) <= H.getAccurateNow(appStateRef.current?.settings?.systemTimeOffset || 0))) {
            DB.setCurrentSessionUser(foundUser);
            setCurrentUser(foundUser);
            setShowLogoutConfirm(false);
          }
        }
      } catch (e) {}
    };

    const unsubCrossTab = H.subscribeCrossTabSync((msg) => {
      if (msg.type === 'SESSION_CHANGE') {
        if (!msg.value) {
          DB.setCurrentSessionUser(null);
          setCurrentUser(null);
          setShowLogoutConfirm(false);
        } else {
          const targetId = msg.value.userId || msg.value.user?.id || msg.value.id;
          const foundUser =
            (appStateRef.current?.users || []).find((u: any) => u.id === targetId) ||
            msg.value.user ||
            (msg.value.role ? msg.value : null) ||
            defaultState.users.find((u: any) => u.id === targetId);
          if (foundUser) {
            DB.setCurrentSessionUser(foundUser);
            setCurrentUser(foundUser);
            setShowLogoutConfirm(false);
          }
        }
      } else if (msg.type === 'STATE_UPDATE' && msg.value) {
        setAppState(msg.value as AppState);
      } else if (msg.type === 'KV_UPDATE' && msg.key === 'eljur_device_prefs' && msg.value) {
        setAppState((prev) => ({
          ...prev,
          settings: {
            ...prev.settings,
            theme: msg.value.theme || 'light',
            language: msg.value.language || 'ru',
            showSeasonalAnimations: msg.value.showSeasonalAnimations !== false,
            bodyFontId: msg.value.bodyFontId || undefined,
            headingFontId: msg.value.headingFontId || undefined,
          },
        }));
      }
    });

    window.addEventListener('focus', syncSessionFromStorage);
    document.addEventListener('visibilitychange', syncSessionFromStorage);
    return () => {
      unsubCrossTab();
      window.removeEventListener('focus', syncSessionFromStorage);
      document.removeEventListener('visibilitychange', syncSessionFromStorage);
    };
  }, []);

  // Subscribe to database error notifications
  useEffect(() => {
    DB.setDatabaseErrorListener((msg) => {
      setDbError(msg);
      setTimeout(() => setDbError(null), 6000);
    });
    return () => DB.setDatabaseErrorListener(null);
  }, []);

  // Keep DB session user reference in sync with currentUser
  useEffect(() => {
    DB.setCurrentSessionUser(currentUser);
  }, [currentUser]);

  // Keep currentUser synchronized with live user updates in appState.users (e.g., employeePermissions, classes, customRole)
  useEffect(() => {
    if (!currentUser || currentUser.role === 'creator') return;
    const latest = (appState?.users || []).find(u => u.id === currentUser.id);
    if (!latest) return;
    const prevPerms = JSON.stringify(currentUser.employeePermissions || null);
    const nextPerms = JSON.stringify(latest.employeePermissions || null);
    const prevClasses = JSON.stringify(currentUser.classes || null);
    const nextClasses = JSON.stringify(latest.classes || null);
    if (
      prevPerms !== nextPerms ||
      prevClasses !== nextClasses ||
      currentUser.customRole !== latest.customRole ||
      currentUser.fio !== latest.fio ||
      currentUser.class !== latest.class ||
      currentUser.letter !== latest.letter ||
      currentUser.role !== latest.role
    ) {
      const updatedUser: User = {
        ...currentUser,
        ...latest,
        theme: currentUser.theme,
        language: currentUser.language,
        showSeasonalAnimations: currentUser.showSeasonalAnimations,
        bodyFontId: currentUser.bodyFontId,
        headingFontId: currentUser.headingFontId
      };
      DB.setCurrentSessionUser(updatedUser);
      setCurrentUser(updatedUser);
    }
  }, [appState?.users, currentUser]);

  // Initialize Data with instant cache fast-path and Firestore real-time sync
  useEffect(() => {
    // Instant fast-path: restore cached state from IndexedDB if available
    const activeSchoolId = (currentUser?.schoolId && currentUser.schoolId !== 'global')
      ? currentUser.schoolId
      : (localStorage.getItem('eljur_active_school_id') || 'school_1');

    DB.getSchoolCache(activeSchoolId).then((cached) => {
      if (cached) {
        const mergeById = <T extends { id: string }>(defaults: T[], current?: T[]) => {
          const map = new Map<string, T>();
          (defaults || []).forEach(item => {
            if (item?.id) map.set(item.id, item);
          });
          (current || []).forEach(item => {
            if (item?.id) map.set(item.id, item);
          });
          return Array.from(map.values());
        };
        const mergeMessagesById = (defaults: any[], current?: any[]) => {
          const map = new Map<string, any>();
          (defaults || []).forEach(item => {
            if (item?.id) {
              const { item: hydrated } = H.applyLocalReadReceipts(item);
              map.set(item.id, hydrated);
            }
          });
          (current || []).forEach(item => {
            if (item?.id) {
              const existing = map.get(item.id);
              map.set(item.id, H.mergeMessageReadState(existing, item));
            }
          });
          return Array.from(map.values());
        };
        setAppState(prev => {
          const combinedSchools = mergeById(
            defaultState.schools,
            mergeById(prev?.schools || [], Array.isArray(cached.schools) ? cached.schools : [])
          );
          const prevSchoolMap = new Map<string, any>((prev?.schools || []).map((s: any) => [s.id, s]));
          const hydratedSchools = combinedSchools.map((s: any) => {
            const pS = prevSchoolMap.get(s.id);
            if (cloudSyncedSchoolsRef.current.has(s.id) && pS) {
              return pS;
            }
            let fallbackEdu = '';
            let fallbackEduResources: any[] | undefined = undefined;
            let fallbackSchoolInfo: string | undefined = undefined;
            let savedSchoolName = '';
            try {
              savedSchoolName = (localStorage.getItem(`eljur_school_name_${s.id}`) || '').trim();
              fallbackEdu = localStorage.getItem(`eljur_edu_url_${s.id}`) || '';
              const rawRes = localStorage.getItem(`eljur_edu_resources_${s.id}`);
              if (rawRes) {
                const parsedRes = JSON.parse(rawRes);
                if (Array.isArray(parsedRes)) fallbackEduResources = parsedRes;
              }
              const rawInfo = localStorage.getItem(`eljur_school_info_${s.id}`);
              if (rawInfo !== null) fallbackSchoolInfo = rawInfo;
            } catch {}
            const rawResolvedInfo = s.schoolInfo ?? pS?.schoolInfo ?? fallbackSchoolInfo ?? (s.id === 'school_1' ? H.DEFAULT_SCHOOL_1_INFO_HTML : undefined);
            const resolvedName = savedSchoolName || s.name || pS?.name || 'Гимназия №1 им. А.С. Пушкина';
            return {
              ...s,
              name: resolvedName,
              educationalResourceUrl: s.educationalResourceUrl || pS?.educationalResourceUrl || fallbackEdu || '',
              educationalResources: s.educationalResources ?? pS?.educationalResources ?? fallbackEduResources,
              schoolInfo: s.id === 'school_1' && typeof rawResolvedInfo === 'string'
                ? H.normalizeLegacySchool1Info(rawResolvedInfo)
                : rawResolvedInfo
            };
          });
          const validClassesBySchool = new Map<string, Set<string>>();
          hydratedSchools.forEach((s: any) => {
            if (s?.id && Array.isArray(s.classes) && s.classes.length > 0) {
              validClassesBySchool.set(s.id, new Set(s.classes.map((c: any) => `${c.class}_${c.letter}`)));
            }
          });
          const hasCachedSchool1Users = Array.isArray(cached.users) && cached.users.some((u: any) => (u.schoolId || 'school_1') === 'school_1');
          const baseUsers = hasCachedSchool1Users
            ? defaultState.users.filter(u => u.role === 'creator' || (u.schoolId && u.schoolId !== 'school_1'))
            : defaultState.users;
          const mergedCachedUsers = mergeById(
            baseUsers,
            mergeById(prev?.users || [], cached.users)
          ).filter((u: any) => {
            if (u.role !== 'student') return true;
            const sid = u.schoolId || 'school_1';
            const validSet = validClassesBySchool.get(sid);
            if (validSet && validSet.size > 0) {
              if (!u.class || !u.letter || !validSet.has(`${u.class}_${u.letter}`)) return false;
            }
            return true;
          });
          const rawCachedAssignments = mergeById(
            hasCachedSchool1Users ? [] : defaultState.teacherAssignments,
            mergeById(prev?.teacherAssignments || [], cached.teacherAssignments)
          ).filter((a: any) => {
            const sid = a.schoolId || 'school_1';
            const validSet = validClassesBySchool.get(sid);
            return !validSet || validSet.size === 0 || validSet.has(a.classId);
          });
          const cachedUserPrefs = H.getUserPreferences(currentUser?.id, null);
          return {
            ...defaultState,
            ...cached,
            schools: hydratedSchools,
            classes: (Array.isArray(cached.classes) && cached.classes.length > 0) ? cached.classes : defaultState.classes,
            subjects: (Array.isArray(cached.subjects) && cached.subjects.length > 0) ? cached.subjects : defaultState.subjects,
            users: mergedCachedUsers,
            schedules: { ...(hasCachedSchool1Users ? {} : defaultState.schedules), ...(prev?.schedules || {}), ...(cached.schedules || {}) },
            grades: { ...(hasCachedSchool1Users ? {} : defaultState.grades), ...(prev?.grades || {}), ...(cached.grades || {}) },
            finalGrades: { ...(hasCachedSchool1Users ? {} : defaultState.finalGrades), ...(prev?.finalGrades || {}), ...(cached.finalGrades || {}) },
            homework: mergeById(hasCachedSchool1Users ? [] : defaultState.homework, mergeById(prev?.homework || [], cached.homework)),
            messages: mergeMessagesById(defaultState.messages, mergeMessagesById(prev?.messages || [], cached.messages)),
            announcements: mergeMessagesById(defaultState.announcements, mergeMessagesById(prev?.announcements || [], cached.announcements)),
            teacherAssignments: rawCachedAssignments,
            quarters: (cached.quarters?.Q1 && cached.quarters.Q1.length > 2) ? cached.quarters : defaultState.quarters,
            scheduleSettings: cached.scheduleSettings?.quarterDefinitions?.Q1?.start ? H.normalizeScheduleSettings(cached.scheduleSettings) : defaultState.scheduleSettings,
            settings: {
              ...defaultState.settings,
              ...(cached.settings || {}),
              theme: cachedUserPrefs.theme || 'light',
              language: cachedUserPrefs.language || 'ru',
              showSeasonalAnimations: cachedUserPrefs.showSeasonalAnimations !== false,
              bodyFontId: cachedUserPrefs.bodyFontId || undefined,
              headingFontId: cachedUserPrefs.headingFontId || undefined
            }
          };
        });
        setLoading(false);

        // If session exists for a custom user stored in cache, restore it
        if (!currentUser) {
          const sessionStr = localStorage.getItem('eljur_session');
          if (sessionStr) {
            try {
              const session = JSON.parse(sessionStr);
              if (session.expires > Date.now()) {
                const foundUser =
                  (cached.users || []).find((user: any) => user.id === session.userId) ||
                  session.user ||
                  defaultState.users.find((user: any) => user.id === session.userId);
                if (foundUser && (!foundUser.blockedUntil || new Date(foundUser.blockedUntil) <= H.getAccurateNow(cached?.settings?.systemTimeOffset || 0))) {
                  DB.setCurrentSessionUser(foundUser);
                  setCurrentUser(foundUser);
                  if (session.viewMode) setViewMode(session.viewMode);
                }
              }
            } catch {}
          }
        }
      }
    }).catch((e) => console.warn('IndexedDB cache load failed:', e));

    if (!currentUser) {
      const sessionStr = localStorage.getItem('eljur_session');
      if (sessionStr) {
        try {
          const session = JSON.parse(sessionStr);
          if (session.expires > Date.now()) {
            const u =
              (appState?.users || []).find((user: any) => user.id === session.userId) ||
              session.user ||
              defaultState.users.find((user: any) => user.id === session.userId);
            if (u && (!u.blockedUntil || new Date(u.blockedUntil) <= H.getAccurateNow(appState?.settings?.systemTimeOffset || 0))) {
              DB.setCurrentSessionUser(u);
              setCurrentUser(u);
              if (session.viewMode) setViewMode(session.viewMode);
              if (DB.auth.currentUser) {
                DB.syncUserAuthUidMap(u.schoolId || activeSchoolId, u.id, u.role, DB.auth.currentUser.uid).catch(() => {});
              }
            }
          }
        } catch (e) {
          console.warn('Session parse failed:', e);
        }
      }
    }

    // Preload public CreatorGate & EljurInfo for unauthenticated Login view
    DB.getPublicCreatorGate(activeSchoolId).then((gate) => {
      if (gate) {
        setAppState(prev => {
          const cur = prev || defaultState;
          return {
            ...cur,
            settings: {
              ...cur.settings,
              secretKey: gate.secretKey || cur.settings.secretKey,
              secretCount: gate.secretCount || cur.settings.secretCount,
              adminPassword: gate.adminPassword || cur.settings.adminPassword || 'admin123',
              adminPasswordHash: gate.adminPasswordHash || cur.settings.adminPasswordHash,
              adminPasswordSalt: gate.adminPasswordSalt || cur.settings.adminPasswordSalt,
              eljurInfo: gate.eljurInfo !== undefined ? gate.eljurInfo : cur.settings.eljurInfo,
              systemTimeOffset: (gate as any).systemTimeOffset !== undefined ? (gate as any).systemTimeOffset : cur.settings.systemTimeOffset
            }
          };
        });
      }
    }).catch(() => {});

    // Safety timeout: ensure loading state never hangs indefinitely
    const safetyTimer = setTimeout(() => {
      setLoading(false);
      setAppState(prev => prev || defaultState);
    }, 2500);

    let unsubSchool: (() => void) | null = null;
    let unsubAllSchools: (() => void) | null = null;
    const extraSchoolUnsubs = new Map<string, () => void>();

    const mergeSchoolUpdate = (targetSid: string, schoolUpdate: Partial<AppState>, isPrimarySchool: boolean) => {
      clearTimeout(safetyTimer);
      setAppState(prev => {
        const cur = prev || defaultState;

        let mergedSchools = [...(cur.schools && cur.schools.length > 0 ? cur.schools : [defaultSchool])];
        if (schoolUpdate.schools && schoolUpdate.schools.length > 0) {
          schoolUpdate.schools.forEach((incS: any) => {
            if (incS.id) cloudSyncedSchoolsRef.current.add(incS.id);
            const idx = mergedSchools.findIndex(s => s.id === incS.id);
            const enriched = {
              ...(idx > -1 ? mergedSchools[idx] : {}),
              ...incS,
              subjects: (incS.subjects && incS.subjects.length > 0) ? incS.subjects : (idx > -1 && mergedSchools[idx].subjects?.length ? mergedSchools[idx].subjects : defaultState.subjects),
              classes: Array.isArray(incS.classes)
                ? (incS.classes.length > 0 || incS.id !== 'school_1' ? incS.classes : defaultState.classes)
                : (idx > -1 && Array.isArray(mergedSchools[idx].classes) ? mergedSchools[idx].classes : (incS.id === 'school_1' ? defaultState.classes : []))
            };
            if (idx > -1) mergedSchools[idx] = enriched;
            else mergedSchools.push(enriched);
          });
        }

        const targetSchoolObj = mergedSchools.find(s => s.id === targetSid);
        const validTargetClassKeys = targetSchoolObj && Array.isArray(targetSchoolObj.classes) && targetSchoolObj.classes.length > 0
          ? new Set(targetSchoolObj.classes.map((c: any) => `${c.class}_${c.letter}`))
          : null;

        let mergedUsers = cur.users || [];
        if (schoolUpdate.users) {
          const otherUsers = mergedUsers.filter(u => (u.schoolId || 'school_1') !== targetSid);
          mergedUsers = [...otherUsers, ...schoolUpdate.users];
          if (mergedUsers.length === 0) mergedUsers = defaultState.users;
        }
        if (validTargetClassKeys) {
          mergedUsers = mergedUsers.filter(u => {
            if ((u.schoolId || 'school_1') !== targetSid) return true;
            if (u.role === 'student' && u.class && u.letter && !validTargetClassKeys.has(`${u.class}_${u.letter}`)) {
              return false;
            }
            return true;
          });
        }

        const existingOrder = cur.userOrder || [];
        const existingOrderSet = new Set(existingOrder);
        const additionalOrderIds = mergedUsers.map(u => u.id).filter(id => !existingOrderSet.has(id));
        const mergedUserOrder = [...existingOrder, ...additionalOrderIds];

        const fullClasses = isPrimarySchool
          ? ((schoolUpdate.classes && schoolUpdate.classes.length > 0) ? schoolUpdate.classes : (cur.classes && cur.classes.length > 0 ? cur.classes : defaultState.classes))
          : cur.classes;

        const fullSubjects = isPrimarySchool
          ? ((schoolUpdate.subjects && schoolUpdate.subjects.length > 0) ? schoolUpdate.subjects : (cur.subjects && cur.subjects.length > 0 ? cur.subjects : defaultState.subjects))
          : cur.subjects;

        let mergedAssignments = cur.teacherAssignments || [];
        if (schoolUpdate.teacherAssignments !== undefined) {
          const otherAssigns = mergedAssignments.filter(a => (a.schoolId || 'school_1') !== targetSid);
          mergedAssignments = [...otherAssigns, ...schoolUpdate.teacherAssignments];
        }
        if (validTargetClassKeys) {
          mergedAssignments = mergedAssignments.filter(a => (a.schoolId || 'school_1') !== targetSid || validTargetClassKeys.has(a.classId));
        }

        let mergedHomework = cur.homework || [];
        if (schoolUpdate.homework !== undefined) {
          const otherHw = mergedHomework.filter(h => (h.schoolId || 'school_1') !== targetSid);
          mergedHomework = [...otherHw, ...schoolUpdate.homework];
        }
        if (validTargetClassKeys) {
          mergedHomework = mergedHomework.filter(h => (h.schoolId || 'school_1') !== targetSid || validTargetClassKeys.has(`${h.class}_${h.letter}`));
        }

        let mergedMessages = cur.messages || [];
        if (schoolUpdate.messages !== undefined) {
          const existingTargetMap = new Map<string, any>();
          mergedMessages.forEach((m: any) => {
            if (m?.id && (m.schoolId || 'school_1') === targetSid) {
              existingTargetMap.set(m.id, m);
            }
          });
          const otherMsgs = mergedMessages.filter(m => (m.schoolId || 'school_1') !== targetSid);
          const msgMap = new Map<string, any>();
          otherMsgs.forEach((m: any) => {
            if (m?.id) msgMap.set(m.id, m);
          });
          schoolUpdate.messages.forEach((m: any) => {
            if (!m?.id) return;
            const prevMsg = existingTargetMap.get(m.id) || msgMap.get(m.id);
            msgMap.set(m.id, H.mergeMessageReadState(prevMsg, m));
          });
          mergedMessages = Array.from(msgMap.values());
        }

        let mergedAnnouncements = cur.announcements || [];
        if (schoolUpdate.announcements !== undefined) {
          const existingTargetMap = new Map<string, any>();
          mergedAnnouncements.forEach((a: any) => {
            if (a?.id && (a.schoolId || 'school_1') === targetSid) {
              existingTargetMap.set(a.id, a);
            }
          });
          const otherAnns = mergedAnnouncements.filter(a => (a.schoolId || 'school_1') !== targetSid);
          const annMap = new Map<string, any>();
          otherAnns.forEach((a: any) => {
            if (a?.id) annMap.set(a.id, a);
          });
          schoolUpdate.announcements.forEach((a: any) => {
            if (!a?.id) return;
            const prevAnn = existingTargetMap.get(a.id) || annMap.get(a.id);
            annMap.set(a.id, H.mergeMessageReadState(prevAnn, a));
          });
          mergedAnnouncements = Array.from(annMap.values());
        }

        let mergedGroups = cur.studentGroups || [];
        if (schoolUpdate.studentGroups !== undefined) {
          const otherGrps = mergedGroups.filter(g => (g.schoolId || 'school_1') !== targetSid);
          mergedGroups = [...otherGrps, ...schoolUpdate.studentGroups];
        }
        if (validTargetClassKeys) {
          mergedGroups = mergedGroups.filter(g => (g.schoolId || 'school_1') !== targetSid || validTargetClassKeys.has(g.classId));
        }

        let nextSchedules = { ...(cur.schedules || {}) };
        if (schoolUpdate.schedules !== undefined) {
          Object.keys(nextSchedules).forEach(k => {
            if (k.startsWith(`${targetSid}__`) || (targetSid === 'school_1' && !k.includes('__'))) {
              delete nextSchedules[k];
            }
          });
          nextSchedules = { ...nextSchedules, ...schoolUpdate.schedules };
        }
        if (validTargetClassKeys) {
          Object.keys(nextSchedules).forEach(k => {
            if (k.startsWith(`${targetSid}__`) || (targetSid === 'school_1' && !k.includes('__'))) {
              const ck = k.includes('__') ? k.split('__').pop()! : k;
              if (!validTargetClassKeys.has(ck)) delete nextSchedules[k];
            }
          });
        }

        let nextGrades = { ...(cur.grades || {}) };
        if (schoolUpdate.grades !== undefined) {
          Object.keys(nextGrades).forEach(k => {
            if (k.startsWith(`${targetSid}__`) || (targetSid === 'school_1' && !k.includes('__'))) {
              delete nextGrades[k];
            }
          });
          nextGrades = { ...nextGrades, ...schoolUpdate.grades };
        }
        if (validTargetClassKeys) {
          Object.keys(nextGrades).forEach(k => {
            if (k.startsWith(`${targetSid}__`) || (targetSid === 'school_1' && !k.includes('__'))) {
              const ck = k.includes('__') ? k.split('__').pop()! : k;
              if (!validTargetClassKeys.has(ck)) delete nextGrades[k];
            }
          });
        }

        let nextFinalGrades = { ...(cur.finalGrades || {}) };
        if (schoolUpdate.finalGrades !== undefined) {
          Object.keys(nextFinalGrades).forEach(k => {
            if (k.startsWith(`${targetSid}__`) || (targetSid === 'school_1' && !k.includes('__'))) {
              delete nextFinalGrades[k];
            }
          });
          nextFinalGrades = { ...nextFinalGrades, ...schoolUpdate.finalGrades };
        }
        if (validTargetClassKeys) {
          Object.keys(nextFinalGrades).forEach(k => {
            if (k.startsWith(`${targetSid}__`) || (targetSid === 'school_1' && !k.includes('__'))) {
              const ck = k.includes('__') ? k.split('__').pop()! : k;
              if (!validTargetClassKeys.has(ck)) delete nextFinalGrades[k];
            }
          });
        }

        const userPrefs = H.getUserPreferences(currentUser?.id, null);

        const incomingSchoolTz = schoolUpdate.schools?.[0]?.timezone || schoolUpdate.settings?.timezone;
        const prevSchoolsSettings = (cur.settings as any)?.schoolsSettings || {};
        const nextSchoolsSettings = incomingSchoolTz
          ? {
              ...prevSchoolsSettings,
              [targetSid]: {
                ...(prevSchoolsSettings[targetSid] || {}),
                timezone: incomingSchoolTz
              }
            }
          : prevSchoolsSettings;

        const baseSettings = isPrimarySchool && schoolUpdate.settings
          ? {
              ...cur.settings,
              ...schoolUpdate.settings,
              schoolsSettings: nextSchoolsSettings,
              ...(currentUser?.role === 'creator'
                ? { timezone: cur.settings?.timezone || 'UTC+3' }
                : {})
            }
          : {
              ...cur.settings,
              schoolsSettings: nextSchoolsSettings,
              ...(schoolUpdate.settings?.systemTimeOffset !== undefined
                ? { systemTimeOffset: schoolUpdate.settings.systemTimeOffset }
                : {})
            };

        const updated: AppState = {
          ...cur,
          schools: mergedSchools,
          classes: fullClasses,
          subjects: fullSubjects,
          users: mergedUsers,
          userOrder: mergedUserOrder,
          teacherAssignments: mergedAssignments,
          schedules: nextSchedules,
          grades: nextGrades,
          finalGrades: nextFinalGrades,
          homework: mergedHomework,
          messages: mergedMessages,
          announcements: mergedAnnouncements,
          studentGroups: mergedGroups,
          quarters: isPrimarySchool && schoolUpdate.quarters ? schoolUpdate.quarters : cur.quarters,
          settings: {
            ...baseSettings,
            theme: userPrefs.theme || 'light',
            language: userPrefs.language || 'ru',
            showSeasonalAnimations: userPrefs.showSeasonalAnimations !== false,
            bodyFontId: userPrefs.bodyFontId || undefined,
            headingFontId: userPrefs.headingFontId || undefined
          },
          gradingSystem: isPrimarySchool ? (schoolUpdate.gradingSystem || cur.gradingSystem) : cur.gradingSystem,
          gradeTypes: isPrimarySchool ? (schoolUpdate.gradeTypes || cur.gradeTypes) : cur.gradeTypes,
          scheduleSettings: isPrimarySchool ? (schoolUpdate.scheduleSettings || cur.scheduleSettings) : cur.scheduleSettings,
          subjectRequirements: isPrimarySchool ? (schoolUpdate.subjectRequirements || cur.subjectRequirements) : cur.subjectRequirements
        };

        if (isPrimarySchool) {
          DB.saveSchoolCache(targetSid, updated);
        }

        return updated;
      });
    };

    if (currentUser) {
      const sId = (currentUser.schoolId && currentUser.schoolId !== 'global')
        ? currentUser.schoolId
        : activeSchoolId;
      const domainSchool = sId.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase() || 'school1';
      const userSafeId = currentUser.id.replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase();
      const virtualEmail = currentUser.role === 'creator'
        ? 'creator@global.eljur.org'
        : `${userSafeId}@${domainSchool}.eljur.org`;

      let isCancelledEffect = false;

      DB.ensureFirebaseAuthSession(
        virtualEmail,
        currentUser.password || 'eljur123456',
        currentUser.password ? [currentUser.password] : [],
        { schoolId: sId, userId: currentUser.id, role: currentUser.role }
      ).catch(() => {}).finally(() => {
        if (isCancelledEffect) return;

        if (currentUser.role === 'creator') {
          unsubAllSchools = DB.subscribeToAllSchools((schools) => {
            if (schools && schools.length > 0) {
              setAppState(prev => {
                const cur = prev || defaultState;
                const prevMap = new Map((cur.schools || []).map(s => [s.id, s]));
                const updatedSchools = schools.map((s: any) => {
                  const existing = prevMap.get(s.id) || ({} as any);
                  return {
                    ...existing,
                    ...s,
                    id: s.id,
                    name: s.name || existing.name || 'Школа',
                    directorId: s.directorId ?? existing.directorId ?? '',
                    educationalResourceUrl: s.educationalResourceUrl ?? existing.educationalResourceUrl ?? '',
                    educationalResources: s.educationalResources ?? existing.educationalResources,
                    schoolInfo: s.schoolInfo ?? existing.schoolInfo,
                    classes: Array.isArray(s.classes) ? s.classes : (existing.classes || []),
                    subjects: (Array.isArray(s.subjects) && s.subjects.length > 0) ? s.subjects : (existing.subjects || defaultState.subjects)
                  };
                });
                return {
                  ...cur,
                  schools: updatedSchools
                };
              });
              const activeIdsSet = new Set(schools.map((s: any) => s.id));
              extraSchoolUnsubs.forEach((unsubFn, sIdKey) => {
                if (!activeIdsSet.has(sIdKey)) {
                  try { unsubFn(); } catch {}
                  extraSchoolUnsubs.delete(sIdKey);
                }
              });
              schools.forEach((s: any) => {
                if (s.id && s.id !== sId && s.id !== 'global' && !extraSchoolUnsubs.has(s.id)) {
                  const uSub = DB.subscribeToSchool(s.id, (upd) => mergeSchoolUpdate(s.id, upd, false));
                  extraSchoolUnsubs.set(s.id, uSub);
                }
              });
            }
          });
        }

        unsubSchool = DB.subscribeToSchool(sId, (schoolUpdate) => {
          mergeSchoolUpdate(sId, schoolUpdate, true);
        });
      });

      return () => {
        isCancelledEffect = true;
        clearTimeout(safetyTimer);
        if (unsubSchool) unsubSchool();
        if (unsubAllSchools) unsubAllSchools();
        extraSchoolUnsubs.forEach(u => u());
        extraSchoolUnsubs.clear();
      };
    } else {
      clearTimeout(safetyTimer);
      setLoading(false);
    }

    return () => {
      clearTimeout(safetyTimer);
      if (unsubSchool) unsubSchool();
      if (unsubAllSchools) unsubAllSchools();
      extraSchoolUnsubs.forEach(u => u());
      extraSchoolUnsubs.clear();
    };
  }, [currentUser?.id, currentUser?.schoolId, currentUser?.role]);

  // Synchronize device-local visual preferences (theme, language, seasonal animations, fonts) with appState.settings
  useEffect(() => {
    setAppState(prev => {
      if (!prev) return prev;
      const prefs = H.getUserPreferences(currentUser?.id, null);
      const nextTheme = prefs.theme || 'light';
      const nextLang = prefs.language || 'ru';
      const nextSeasonal = prefs.showSeasonalAnimations !== false;
      const nextBodyFont = prefs.bodyFontId || undefined;
      const nextHeadingFont = prefs.headingFontId || undefined;
      if (
        prev.settings.theme === nextTheme &&
        prev.settings.language === nextLang &&
        prev.settings.showSeasonalAnimations === nextSeasonal &&
        prev.settings.bodyFontId === nextBodyFont &&
        prev.settings.headingFontId === nextHeadingFont
      ) {
        return prev;
      }
      return {
        ...prev,
        settings: {
          ...prev.settings,
          theme: nextTheme,
          language: nextLang,
          showSeasonalAnimations: nextSeasonal,
          bodyFontId: nextBodyFont,
          headingFontId: nextHeadingFont
        }
      };
    });
  }, [currentUser?.id]);

  // Effect to toggle body class for theme (applies to Login screen and all users on this device)
  useEffect(() => {
    const activeTheme = H.getUserPreferences(currentUser?.id, null).theme || appState?.settings?.theme || 'light';
    if (activeTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [appState?.settings?.theme, currentUser?.id]);

  // Effect to set HTML lang for native input localization
  useEffect(() => {
    const activeLang = H.getUserPreferences(currentUser?.id, null).language || appState?.settings?.language || 'ru';
    document.documentElement.lang = activeLang;
  }, [appState?.settings?.language, currentUser?.id]);

  // Effect to Apply Fonts (device-local across Login screen and all users)
  useEffect(() => {
    const readBlobAsDataURL = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const applyFonts = async () => {
        const root = document.documentElement;

        // Reset to default first
        root.style.setProperty('--font-body', 'Inter');
        root.style.setProperty('--font-heading', 'Inter');

        const prefs = H.getUserPreferences(currentUser?.id, null);
        const bodyFontId = prefs.bodyFontId || appState?.settings?.bodyFontId;
        const headingFontId = prefs.headingFontId || appState?.settings?.headingFontId;
        const fallbackSid = currentUser?.schoolId || 'global';

        if (bodyFontId) {
            try {
                const asset = await DB.getAsset(bodyFontId, fallbackSid);
                if (asset && asset.blob) {
                    const dataUrl = await readBlobAsDataURL(asset.blob);
                    const fontFace = new FontFace('CustomBodyFont', `url(${dataUrl})`);
                    await fontFace.load();
                    document.fonts.add(fontFace);
                    root.style.setProperty('--font-body', '"CustomBodyFont"');
                }
            } catch (e) { console.error("Failed to load body font", e); }
        }

        if (headingFontId) {
            try {
                const asset = await DB.getAsset(headingFontId, fallbackSid);
                if (asset && asset.blob) {
                    const dataUrl = await readBlobAsDataURL(asset.blob);
                    const fontFace = new FontFace('CustomHeadingFont', `url(${dataUrl})`);
                    await fontFace.load();
                    document.fonts.add(fontFace);
                    root.style.setProperty('--font-heading', '"CustomHeadingFont"');
                }
            } catch (e) { console.error("Failed to load heading font", e); }
        }
    };
    applyFonts();
  }, [appState?.settings?.bodyFontId, appState?.settings?.headingFontId, currentUser?.id, currentUser?.schoolId]);

  // Effect to load custom fonts for Eljur Info
  useEffect(() => {
    if (!appState) return;
    const loadCustomFonts = async () => {
      const assets = await DB.getAllAssets();
      const fonts = assets.filter(a => a.name.toLowerCase().endsWith('.ttf') || a.name.toLowerCase().endsWith('.woff') || a.name.toLowerCase().endsWith('.woff2'));
      
      const loadedFonts: {name: string, displayName: string}[] = [];
      const readBlobAsDataURL = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      };

      for (const font of fonts) {
        try {
          const dataUrl = await readBlobAsDataURL(font.blob);
          const fontName = `customfont_${font.id.replace(/[^a-zA-Z0-9]/g, '')}`;
          const fontFace = new FontFace(fontName, `url(${dataUrl})`);
          await fontFace.load();
          document.fonts.add(fontFace);
          loadedFonts.push({ name: fontName, displayName: font.name.replace(/\.[^/.]+$/, "") });
        } catch (e) {
          console.error("Failed to load custom font", e);
        }
      }
      setCustomFonts(loadedFonts);
    };
    loadCustomFonts();
  }, [appState?.settings?.eljurInfo]);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingStateRef = useRef<AppState | null>(null);

  const flushPendingState = (stateToFlush: AppState) => {
    if (currentUser?.role === 'creator') {
      const activeIds = (stateToFlush.schools || []).map(s => s.id).filter(id => id && id !== 'global');
      const schoolIds = Array.from(new Set(activeIds.length > 0 ? activeIds : ['school_1']));
      schoolIds.forEach(sId => {
        DB.saveSchoolState(sId, stateToFlush);
        DB.saveSchoolCache(sId, stateToFlush);
      });
      if (!schoolIds.includes('school_1')) {
        DB.saveSchoolCache('school_1', stateToFlush);
      }
    } else {
      const targetSchoolId = currentUser?.schoolId && currentUser.schoolId !== 'global'
        ? currentUser.schoolId
        : (stateToFlush.schools[0]?.id || 'school_1');
      DB.saveSchoolState(targetSchoolId, stateToFlush);
      DB.saveSchoolCache(targetSchoolId, stateToFlush);
    }
  };

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (pendingStateRef.current) {
        flushPendingState(pendingStateRef.current);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [currentUser?.schoolId, currentUser?.role]);

  const handleUpdateState = (newState: AppState) => {
    const prefs = H.getUserPreferences(currentUser?.id, null);
    const clonedState: AppState = {
      ...newState,
      schools: [...(newState.schools || [])],
      users: [...(newState.users || [])],
      homework: [...(newState.homework || [])],
      messages: [...(newState.messages || [])],
      announcements: [...(newState.announcements || [])],
      teacherAssignments: [...(newState.teacherAssignments || [])],
      studentGroups: [...(newState.studentGroups || [])],
      schedules: { ...(newState.schedules || {}) },
      grades: { ...(newState.grades || {}) },
      finalGrades: { ...(newState.finalGrades || {}) },
      quarters: { ...(newState.quarters || { Q1: [], Q2: [], Q3: [], Q4: [] }) },
      settings: {
        ...(newState.settings || {}),
        theme: prefs.theme || newState.settings?.theme || 'light',
        language: prefs.language || newState.settings?.language || 'ru',
        showSeasonalAnimations: prefs.showSeasonalAnimations !== undefined ? prefs.showSeasonalAnimations : (newState.settings?.showSeasonalAnimations !== false),
        bodyFontId: prefs.bodyFontId || undefined,
        headingFontId: prefs.headingFontId || undefined
      }
    };
    setAppState(clonedState);
    pendingStateRef.current = clonedState;
    H.emitCrossTabSync('STATE_UPDATE', 'appState', clonedState);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      if (pendingStateRef.current) {
        flushPendingState(pendingStateRef.current);
        pendingStateRef.current = null;
      }
    }, 80);
  };

  const handleLogin = (u: User) => {
    const prefs = H.getUserPreferences(u.id, null);
    const enrichedUser: User = {
      ...u,
      theme: prefs.theme || 'light',
      language: prefs.language || 'ru',
      showSeasonalAnimations: prefs.showSeasonalAnimations !== false,
      bodyFontId: prefs.bodyFontId || undefined,
      headingFontId: prefs.headingFontId || undefined
    };
    DB.setCurrentSessionUser(enrichedUser);
    setCurrentUser(enrichedUser);
    setViewMode('dashboard');
    if (enrichedUser.schoolId && enrichedUser.schoolId !== 'global') {
      try { localStorage.setItem('eljur_active_school_id', enrichedUser.schoolId); } catch {}
    }
    if (appState) {
      setAppState(prev => {
        const userExists = prev.users.some(usr => usr.id === enrichedUser.id);
        const updatedUsers = userExists ? prev.users : [...prev.users, enrichedUser];
        return {
          ...prev,
          users: updatedUsers,
          settings: {
            ...prev.settings,
            theme: prefs.theme || 'light',
            language: prefs.language || 'ru',
            showSeasonalAnimations: prefs.showSeasonalAnimations !== false,
            bodyFontId: prefs.bodyFontId || undefined,
            headingFontId: prefs.headingFontId || undefined
          }
        };
      });
    }
    
    const safeSessionUser = { ...enrichedUser };
    delete (safeSessionUser as any).password;
    const expires = Date.now() + 60 * 60 * 1000;
    const sessionPayload = { userId: enrichedUser.id, user: safeSessionUser, expires, viewMode: 'dashboard' };
    localStorage.setItem('eljur_session', JSON.stringify(sessionPayload));
    H.emitCrossTabSync('SESSION_CHANGE', 'eljur_session', sessionPayload);
    
    const school = appState?.schools.find(s => s.id === enrichedUser.schoolId);
    if (school) {
        localStorage.setItem('eljur_last_school_name', school.name);
    }
  };
  const handleLogout = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (pendingStateRef.current) {
      flushPendingState(pendingStateRef.current);
      pendingStateRef.current = null;
    }
    const prefs = H.getUserPreferences(null, null);
    DB.setCurrentSessionUser(null);
    setCurrentUser(null);
    setViewMode('dashboard');
    if (appState) {
      setAppState({
        ...appState,
        settings: {
          ...appState.settings,
          theme: prefs.theme || 'light',
          language: prefs.language || 'ru',
          showSeasonalAnimations: prefs.showSeasonalAnimations !== false,
          bodyFontId: prefs.bodyFontId || undefined,
          headingFontId: prefs.headingFontId || undefined
        }
      });
    }
    localStorage.removeItem('eljur_session');
    H.emitCrossTabSync('SESSION_CHANGE', 'eljur_session', null);
  };

  const currentSchool = appState?.schools.find(s => s.id === currentUser?.schoolId);
  const effectiveTimezoneTarget = currentUser?.role === 'creator' ? 'global' : currentUser?.schoolId;
  H.setActiveTimeContext(
    appState?.settings?.systemTimeOffset || 0,
    H.getSchoolTimezone(appState, effectiveTimezoneTarget)
  );
  const currentUserPrefs = H.getUserPreferences(currentUser?.id, null);
  const lang = currentUserPrefs.language || appState?.settings?.language || 'ru';
  const t = (k: string) => H.t(k, lang);
  const eduResources = currentUser && currentUser.role !== 'creator'
    ? H.getSchoolEducationalResources(appState, currentUser.schoolId)
    : [];
  const schoolInfoRaw = currentUser && currentUser.role !== 'creator'
    ? H.getSchoolInfo(appState, currentUser.schoolId)
    : '';
  const hasSchoolInfo = H.hasRichInfoContent(schoolInfoRaw);

  // Render loading state
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-blue-600 font-medium dark:bg-slate-900">{H.t('loading', lang)}</div>;
  if (!appState) return <div className="p-10 text-red-600">{H.t('error_state', lang)}</div>;

  const showAnimations = currentUserPrefs.showSeasonalAnimations !== false;

  const renderRichInfoContent = (info: string, fallbackHtml: string = '') => {
    const responsiveInfoCss = `
      ${customFonts.map(f => `
        .ql-font-${H.sanitizeCssIdentifier(f.name)} {
          font-family: "${H.sanitizeCssIdentifier(f.name)}", sans-serif;
        }
      `).join('\n')}
      .custom-eljur-info .ql-container.ql-snow {
        border: none !important;
        height: auto !important;
        min-height: 100%;
        flex: 1;
        display: flex;
        flex-direction: column;
        background: transparent !important;
      }
      .custom-eljur-info .ql-editor,
      .eljur-info-readonly .ql-editor {
        min-height: 100%;
        flex: 1;
        overflow-y: visible !important;
        padding: 10px 12px !important;
        background: transparent !important;
      }
      @media (min-width: 640px) {
        .custom-eljur-info .ql-editor,
        .eljur-info-readonly .ql-editor {
          padding: 16px 20px !important;
        }
      }
      .custom-eljur-info .ql-toolbar {
        display: none !important;
      }
      .custom-eljur-info .ql-editor img,
      .eljur-info-readonly .ql-editor img {
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        height: auto !important;
        border-radius: 12px;
        margin: 6px 0 !important;
      }
      @media (max-width: 639px) {
        .custom-eljur-info .ql-editor,
        .eljur-info-readonly .ql-editor {
          font-size: 12px !important;
          line-height: 1.45 !important;
        }
        .custom-eljur-info .ql-editor h1,
        .eljur-info-readonly .ql-editor h1 {
          font-size: 16px !important;
          line-height: 1.3 !important;
          margin-bottom: 6px !important;
        }
        .custom-eljur-info .ql-editor h2,
        .eljur-info-readonly .ql-editor h2 {
          font-size: 14px !important;
          line-height: 1.3 !important;
          margin-top: 8px !important;
          margin-bottom: 6px !important;
        }
        .custom-eljur-info .ql-editor h3,
        .eljur-info-readonly .ql-editor h3 {
          font-size: 13px !important;
          line-height: 1.3 !important;
          margin-top: 8px !important;
          margin-bottom: 4px !important;
        }
        .custom-eljur-info .ql-editor p,
        .eljur-info-readonly .ql-editor p,
        .custom-eljur-info .ql-editor li,
        .eljur-info-readonly .ql-editor li {
          font-size: 12px !important;
          line-height: 1.45 !important;
          margin-bottom: 4px !important;
        }
        .custom-eljur-info .ql-editor ul,
        .eljur-info-readonly .ql-editor ul,
        .custom-eljur-info .ql-editor ol,
        .eljur-info-readonly .ql-editor ol {
          padding-left: 1.1em !important;
        }
      }
    `;
    try {
      const parsed = JSON.parse(info);
      if (parsed && parsed.isComplex) {
        const safeBg = H.sanitizeSafeUrl(parsed.backgroundImage, 'background');
        const safeQuillHtml = H.sanitizeRichHtml(parsed.quillContent || fallbackHtml);
        const safeElements = Array.isArray(parsed.elements) ? parsed.elements : [];
        const maxElementBottom = safeElements.reduce((max: number, el: any) => {
          const top = typeof el?.y === 'number' ? el.y : parseFloat(el?.y) || 0;
          const height = typeof el?.h === 'number' ? el.h : parseFloat(el?.h) || 200;
          return Math.max(max, top + height + 32);
        }, 0);
        return (
          <div 
            className="relative bg-white dark:bg-slate-900 text-black dark:text-white rounded-lg border border-slate-200 dark:border-slate-700 w-full max-w-3xl mx-auto flex flex-col min-h-[320px] sm:min-h-[600px]"
            style={{
              ...(safeBg ? {
                backgroundImage: `url(${safeBg})`,
                backgroundRepeat: 'repeat-y',
                backgroundSize: '100% auto',
                backgroundPosition: 'top center'
              } : {}),
              ...(maxElementBottom > 320 ? { minHeight: `${maxElementBottom}px` } : {})
            }}
          >
            <style>{responsiveInfoCss}</style>
            <ReactQuill 
              theme="snow" 
              value={safeQuillHtml} 
              readOnly={true}
              modules={{
                toolbar: false
              }}
              className="custom-eljur-info flex-1 flex flex-col pb-4 sm:pb-8"
            />
            {safeElements.map((el: any) => (
              <div key={el.id} style={{ position: 'absolute', left: el.x, top: el.y, width: el.w, height: el.h, ...el.style }} className="z-10">
                <div style={{ transform: `rotate(${el.rotation || 0}deg)`, width: '100%', height: '100%' }}>
                  {el.type === 'text' ? (
                    <div 
                      dangerouslySetInnerHTML={{ __html: H.sanitizeRichHtml(el.content || '') }}
                      className="w-full h-full p-2 sm:p-3 text-xs sm:text-sm bg-white/90 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-600 rounded shadow-sm overflow-auto"
                    />
                  ) : el.type === 'iframe' ? (
                    <iframe
                      src={H.sanitizeSafeUrl(el.src, 'iframe')}
                      sandbox="allow-scripts allow-same-origin allow-presentation"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain bg-black/5 rounded"
                      allowFullScreen
                    />
                  ) : el.type === 'video' ? (
                    <video src={H.sanitizeSafeUrl(el.src, 'video')} controls className="w-full h-full object-contain bg-black/5 rounded" />
                  ) : (
                    <img src={H.sanitizeSafeUrl(el.src, 'image')} alt="" className="w-full h-full object-contain rounded" draggable={false} />
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      }
    } catch (e) {
      // Fallback to normal HTML
    }
    return (
      <div className="ql-snow eljur-info-readonly">
        <style>{responsiveInfoCss}</style>
        <div className="ql-editor p-0 space-y-2 sm:space-y-3" dangerouslySetInnerHTML={{ __html: H.sanitizeRichHtml(info) }} />
      </div>
    );
  };

  const renderEljurInfo = () => {
    const info = H.getSchoolEljurInfo(appState, currentUser?.schoolId) || H.DEFAULT_ELJUR_INFO_HTML;
    return renderRichInfoContent(info, H.DEFAULT_ELJUR_INFO_HTML);
  };

  const renderSchoolInfo = () => {
    return renderRichInfoContent(schoolInfoRaw, '');
  };

  return (
    <div className={`min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-300 font-sans overflow-x-hidden`}>
      {/* Seasonal Background is rendered here, at the top level, to persist across Login/Dashboard views and avoid reset */}
      <SeasonalBackground enabled={showAnimations} timeOffset={appState.settings.systemTimeOffset} />

      {!currentUser ? (
        <Login 
          users={(appState?.users && appState.users.length > 0) ? appState.users : defaultState.users} 
          onLogin={handleLogin} 
          schoolName={localStorage.getItem('eljur_last_school_name') || 'ЭлЖур'} 
          settings={appState?.settings || defaultState.settings} 
          onShowInfo={() => setShowEljurInfo(true)} 
        />
      ) : (
        <>
          {/* Header */}
          <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 no-print shadow-sm dark:bg-slate-900/80 dark:border-slate-800">
            <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
              {/* Mobile Header (< md): Left = Tabs Menu Button, Right = Blue ElZhur + Settings + Logout */}
              <div className="flex md:hidden justify-between h-13 items-center py-1.5 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (viewMode === 'settings') setViewMode('dashboard');
                    setMobileMenuOpen(prev => !prev);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 font-bold text-xs transition-all shadow-xs"
                  title={lang === 'ru' ? 'Меню вкладок' : 'Tabs menu'}
                >
                  <Menu size={18} className="text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>{lang === 'ru' ? 'Вкладки' : 'Menu'}</span>
                  {(() => {
                    const unreadTotal = H.getUnreadMessagesCount(appState, currentUser) + (currentUser.role !== 'creator' ? H.getUnreadAnnouncementsCount(appState, currentUser) : 0);
                    return unreadTotal > 0 ? (
                      <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] ${unreadTotal > 9 ? 'px-1' : 'w-[18px] px-0'} text-[10px] font-bold rounded-full bg-red-500 text-white leading-none shrink-0`}>
                        {unreadTotal > 99 ? '99+' : unreadTotal}
                      </span>
                    ) : null;
                  })()}
                </button>

                <div className="flex items-center gap-1.5">
                  <img
                    onClick={() => setShowEljurInfo(true)}
                    src={`${import.meta.env.BASE_URL}assets/icon.png`}
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (!img.src.endsWith('tab-favicon.png')) {
                        img.src = `${import.meta.env.BASE_URL}tab-favicon.png`;
                      }
                    }}
                    alt={t('info_eljur')}
                    title={t('info_eljur')}
                    draggable={false}
                    className="w-8 h-8 flex-shrink-0 object-contain cursor-pointer active:scale-95 transition-transform select-none"
                  />

                  {currentUser.role !== 'creator' && (
                    <button
                      type="button"
                      onClick={() => setShowEmptyEduResourceModal(true)}
                      className="p-2 rounded-xl transition-all bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300 flex items-center justify-center"
                      title={t('educational_resource')}
                      aria-label={t('educational_resource')}
                    >
                      <GraduationCap size={18} />
                    </button>
                  )}

                  <button 
                    type="button"
                    onClick={() => setViewMode(viewMode === 'settings' ? 'dashboard' : 'settings')}
                    className={`p-2 rounded-xl transition-all ${viewMode === 'settings' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
                    title={t('settings')}
                  >
                    <SettingsIcon size={18} />
                  </button>

                  <button 
                    type="button"
                    onClick={() => setShowLogoutConfirm(true)} 
                    className="flex items-center justify-center text-red-600 hover:text-red-700 font-semibold bg-red-50 hover:bg-red-100 p-2 rounded-xl transition-colors dark:bg-red-900/20 dark:text-red-400"
                    title={t('exit')}
                  >
                    <LogOut size={17} />
                  </button>
                </div>
              </div>

              {/* Tablet & Desktop Header (md and up) */}
              <div className="hidden md:flex justify-between h-18 items-center py-3 gap-2">
                <div className="flex items-center gap-3 cursor-pointer group min-w-0" onClick={() => setViewMode('dashboard')}>
                  <img
                    onClick={(e) => { e.stopPropagation(); setShowEljurInfo(true); }}
                    src={`${import.meta.env.BASE_URL}assets/icon.png`}
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (!img.src.endsWith('tab-favicon.png')) {
                        img.src = `${import.meta.env.BASE_URL}tab-favicon.png`;
                      }
                    }}
                    alt={t('info_eljur')}
                    title={t('info_eljur')}
                    draggable={false}
                    className="w-[52px] h-[52px] flex-shrink-0 object-contain transition-transform transform group-hover:scale-105 select-none"
                  />
                  <div className="min-w-0">
                    <h1 className="text-lg font-bold text-slate-800 leading-tight dark:text-white font-heading truncate max-w-xs">
                      {currentUser.role === 'creator' ? t('creator_panel') : (currentSchool?.name || t('footer_text'))}
                    </h1>
                    <p className="text-xs text-slate-500 font-medium dark:text-slate-400">v7 Release</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                      {H.formatShortName(currentUser.fio)}
                    </p>
                    <div className="flex justify-end mt-0.5">
                       <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full inline-block dark:bg-slate-800 dark:text-slate-400">
                         {currentUser.role === 'director' ? t('director') : currentUser.role === 'teacher' ? t('teacher') : currentUser.role === 'student' ? `${t('student')}${currentUser.class ? ` • ${currentUser.class}${currentUser.letter || ''}` : ''}` : currentUser.role === 'employee' ? `${currentUser.customRole || t('employee')}${currentUser.employeePermissions?.isTeacher ? ` • ${t('teacher')}` : ''}` : t('creator')}
                       </p>
                    </div>
                  </div>
                  
                  <div className="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>

                  <div className="flex items-center gap-1.5">
                    {currentUser.role !== 'creator' && (
                      <button
                        type="button"
                        onClick={() => setShowEmptyEduResourceModal(true)}
                        className="p-2.5 rounded-xl transition-all hover:bg-slate-100 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 flex items-center justify-center"
                        title={t('educational_resource')}
                        aria-label={t('educational_resource')}
                      >
                        <GraduationCap size={20} />
                      </button>
                    )}

                    <button 
                      onClick={() => setViewMode(viewMode === 'settings' ? 'dashboard' : 'settings')}
                      className={`p-2.5 rounded-xl transition-all ${viewMode === 'settings' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'}`}
                      title={t('settings')}
                    >
                      <SettingsIcon size={20} />
                    </button>
                  </div>

                  <button 
                    onClick={() => setShowLogoutConfirm(true)} 
                    className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 font-semibold bg-red-50 hover:bg-red-100 px-4 py-2.5 rounded-xl transition-colors dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
                    title={t('exit')}
                  >
                    <LogOut size={16} />
                    <span>{t('exit')}</span>
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-2.5 sm:px-6 lg:px-8 py-3 sm:py-8 animate-in fade-in slide-in-from-bottom-2 duration-500 relative z-10">
            {viewMode === 'settings' ? (
              <Settings state={appState} onUpdate={handleUpdateState} onBack={() => setViewMode('dashboard')} user={currentUser} />
            ) : (
              <>
                {currentUser.role === 'creator' && (
                  <CreatorDashboard state={appState} onUpdate={handleUpdateState} user={currentUser} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />
                )}
                {currentUser.role === 'director' && (
                  <DirectorDashboard state={appState} onUpdate={handleUpdateState} user={currentUser} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />
                )}
                {currentUser.role === 'teacher' && (
                  <TeacherDashboard state={appState} onUpdate={handleUpdateState} user={currentUser} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />
                )}
                {currentUser.role === 'student' && (
                  <StudentDashboard state={appState} onUpdate={handleUpdateState} user={currentUser} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />
                )}
                {currentUser.role === 'employee' && (
                  <EmployeeDashboard state={appState} onUpdate={handleUpdateState} user={currentUser} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />
                )}
              </>
            )}
          </main>
          
          <footer className="py-8 text-center text-slate-400 text-xs no-print border-t border-slate-200 mt-auto bg-white dark:bg-slate-900 dark:border-slate-800 relative z-10">
            &copy; {H.getSchoolNow(appState, currentUser?.schoolId).getFullYear()} {t('footer_text')}.
          </footer>
          
        </>
      )}

      <Modal isOpen={showEljurInfo} onClose={() => setShowEljurInfo(false)} title={t('info_eljur')} maxWidth="max-w-5xl w-full">
        {renderEljurInfo()}
      </Modal>

      <Modal
        isOpen={showEmptyEduResourceModal}
        onClose={() => setShowEmptyEduResourceModal(false)}
        title={currentSchool?.name || t('educational_resources')}
        maxWidth={hasSchoolInfo ? "max-w-5xl w-full" : "max-w-xl w-full"}
      >
        {eduResources.length === 0 && !hasSchoolInfo ? (
          <div className="py-4 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto">
              <GraduationCap size={24} />
            </div>
            <p className="text-slate-700 dark:text-slate-300 text-sm sm:text-base font-medium">
              {t('educational_resource_empty')}
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {eduResources.length > 0 && (
              <div className="space-y-2.5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                  {t('educational_resources')}
                </div>
                <div className="grid gap-2">
                  {eduResources.map((res) => (
                    <div
                      key={res.id}
                      className="group flex items-center justify-between gap-2 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 hover:bg-blue-50/80 hover:border-blue-300 dark:bg-slate-800/60 dark:hover:bg-blue-900/25 dark:hover:border-blue-700 transition-all"
                    >
                      <a
                        href={res.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 min-w-0 flex-1"
                      >
                        <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <GraduationCap size={18} />
                        </div>
                        <span className="font-semibold text-sm sm:text-base text-blue-600 group-hover:text-blue-700 dark:text-blue-400 dark:group-hover:text-blue-300 underline-offset-4 group-hover:underline truncate">
                          {res.title}
                        </span>
                      </a>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (navigator.clipboard && navigator.clipboard.writeText) {
                              navigator.clipboard.writeText(res.url).catch(() => {});
                            } else {
                              try {
                                const ta = document.createElement('textarea');
                                ta.value = res.url;
                                ta.style.position = 'fixed';
                                ta.style.opacity = '0';
                                document.body.appendChild(ta);
                                ta.select();
                                document.execCommand('copy');
                                document.body.removeChild(ta);
                              } catch {}
                            }
                            setCopiedResourceId(res.id);
                            setTimeout(() => {
                              setCopiedResourceId(prev => (prev === res.id ? null : prev));
                            }, 2000);
                          }}
                          className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-100/70 dark:text-slate-500 dark:hover:text-blue-400 dark:hover:bg-blue-900/40 transition-colors"
                          title={lang === 'ru' ? 'Скопировать ссылку' : 'Copy link'}
                          aria-label={lang === 'ru' ? 'Скопировать ссылку' : 'Copy link'}
                        >
                          {copiedResourceId === res.id ? (
                            <Check size={16} className="text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Copy size={16} />
                          )}
                        </button>
                        <a
                          href={res.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-100/70 dark:text-slate-500 dark:hover:text-blue-400 dark:hover:bg-blue-900/40 transition-colors"
                          title={lang === 'ru' ? 'Открыть ресурс' : 'Open resource'}
                          aria-label={lang === 'ru' ? 'Открыть ресурс' : 'Open resource'}
                        >
                          <ExternalLink size={16} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hasSchoolInfo && (
              <div className={eduResources.length > 0 ? "pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5" : "space-y-2.5"}>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                  {t('school_info_section')}
                </div>
                {renderSchoolInfo()}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal 
        isOpen={showLogoutConfirm} 
        onClose={() => setShowLogoutConfirm(false)} 
        title={t('confirm_exit_title')}
      >
        <div className="space-y-4 p-1">
          <p className="text-slate-700 dark:text-slate-300 text-sm sm:text-base leading-relaxed">
            {t('confirm_exit_msg')}
          </p>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="secondary" onClick={() => setShowLogoutConfirm(false)}>
              {t('cancel')}
            </Button>
            <Button 
              variant="primary" 
              onClick={() => {
                setShowLogoutConfirm(false);
                handleLogout();
              }} 
              className="bg-red-600 hover:bg-red-700 text-white border-none shadow-md shadow-red-500/20"
            >
              <LogOut size={16} className="mr-1.5" />
              {t('confirm_exit_btn')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Visual error feedback for database save/read issues */}
      {dbError && (
        <div id="db-error-toast" className="fixed bottom-6 right-6 z-50 bg-red-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-bounce">
          <span className="text-lg">⚠️</span>
          <span className="font-medium text-sm">{dbError}</span>
          <button 
            id="dismiss-db-error-btn"
            onClick={() => setDbError(null)} 
            className="ml-2 hover:opacity-80 text-white font-bold p-1 leading-none"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
