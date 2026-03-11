// src/api/reminders.js
import client from './client';

export const getReminders        = ()         => client.get('/reminders').then((r) => r.data);
export const getRemindersByDate  = (date)     => client.get('/reminders/index_by_date', { params: { date } }).then((r) => r.data);
export const getReminder         = (id)       => client.get(`/reminders/${id}`).then((r) => r.data);
export const createReminder      = (data)     => client.post('/reminders', { reminder: data }).then((r) => r.data);
export const updateReminder      = (id, data) => client.patch(`/reminders/${id}`, { reminder: data }).then((r) => r.data);
export const deleteReminder      = (id)       => client.delete(`/reminders/${id}`).then((r) => r.data);
export const completeReminder    = (id)       => client.patch(`/reminders/${id}/complete`).then((r) => r.data);
export const addUserToReminder   = (id, userId) => client.post(`/reminders/${id}/add_user`, { user_id: userId }).then((r) => r.data);
export const getSpecialEvents    = (id)       => client.get(`/reminders/${id}/special_events`).then((r) => r.data);

export const getNotes   = ()         => client.get('/notes').then((r) => r.data);
export const getNote    = (id)       => client.get(`/notes/${id}`).then((r) => r.data);
export const createNote = (data)     => client.post('/notes', { note: data }).then((r) => r.data);
export const updateNote = (id, data) => client.patch(`/notes/${id}`, { note: data }).then((r) => r.data);
export const deleteNote = (id)       => client.delete(`/notes/${id}`).then((r) => r.data);

export const computeStats = (reminders = []) => {
  const today = new Date();
  const isToday = (d) => {
    const dt = new Date(d);
    return dt.getDate() === today.getDate() &&
      dt.getMonth() === today.getMonth() &&
      dt.getFullYear() === today.getFullYear();
  };
  const isOverdue = (d) => new Date(d) < today && !isToday(d);
  return {
    total:     reminders.length,
    today:     reminders.filter((r) => r.due_date && isToday(r.due_date)).length,
    completed: reminders.filter((r) => r.completed).length,
    overdue:   reminders.filter((r) => r.due_date && isOverdue(r.due_date) && !r.completed).length,
  };
};