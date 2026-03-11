// src/api/social.js
import client from './client';

// ── Users ─────────────────────────────────────────────────────────────────────
export const getUsers    = ()  => client.get('/users').then((r) => r.data);
export const searchUsers = (q) => client.get('/users/search', { params: { q } }).then((r) => r.data);

// ── Friend Requests ───────────────────────────────────────────────────────────
// The controller uses current_user for accepted/received/sent — the :id segment
// is required by the route but ignored by those actions, so we pass 0 as a placeholder.
export const sendFriendRequest    = (receiverId, relationshipCategory = 'friend') => client.post('/friend_requests', { receiver_id: receiverId, relationship_category: relationshipCategory }).then((r) => r.data);
export const acceptFriendRequest  = (id)         => client.put(`/friend_requests/${id}/accept`).then((r) => r.data);
export const declineFriendRequest = (id)         => client.put(`/friend_requests/${id}/decline`).then((r) => r.data);
export const getReceivedRequests  = ()           => client.get('/friend_requests/0/received').then((r) => r.data);
export const getSentRequests      = ()           => client.get('/friend_requests/0/sent').then((r) => r.data);
export const getAcceptedFriends   = ()           => client.get('/friend_requests/0/accepted').then((r) => r.data);

// ── Invitations ───────────────────────────────────────────────────────────────
export const getInvitations       = ()         => client.get('/invitations').then((r) => r.data);
export const createInvitation     = (data)     => client.post('/invitations', { invitation: data }).then((r) => r.data);
export const acceptInvitation     = (id)       => client.post(`/invitations/${id}/accept`).then((r) => r.data);
export const declineInvitation    = (id)       => client.post(`/invitations/${id}/decline`).then((r) => r.data);
export const rescheduleInvitation = (id, data) => client.post(`/invitations/${id}/reschedule`, data).then((r) => r.data);
export const deleteInvitation     = (id)       => client.delete(`/invitations/${id}`).then((r) => r.data);

// ── Organizations ─────────────────────────────────────────────────────────────
export const getOrganizations    = ()          => client.get('/organizations').then((r) => r.data);
export const getOrganization     = (id)        => client.get(`/organizations/${id}`).then((r) => r.data);
export const createOrganization  = (data)      => client.post('/organizations', { organization: data }).then((r) => r.data);
export const updateOrganization  = (id, data)  => client.patch(`/organizations/${id}`, { organization: data }).then((r) => r.data);
export const deleteOrganization  = (id)        => client.delete(`/organizations/${id}`).then((r) => r.data);
export const addMember           = (orgId, data) => client.post(`/organizations/${orgId}/memberships`, data).then((r) => r.data);

// ── Conversations & Messages ───────────────────────────────────────────────────
export const getConversations        = ()              => client.get('/conversations').then((r) => r.data);
export const getOrCreateConversation = (participantId) => client.post('/conversations', { participant_id: participantId }).then((r) => r.data);
export const getMessages             = (convId, page = 1) => client.get(`/conversations/${convId}/messages`, { params: { page } }).then((r) => r.data);
export const sendMessage             = (convId, content)  => client.post(`/conversations/${convId}/messages`, { content }).then((r) => r.data);
export const markConversationRead    = (convId)            => client.patch(`/conversations/${convId}/mark_read`).then((r) => r.data);


export const getNotifications      = ()     => client.get('/notifications').then((r) => r.data);
export const createNotification    = (data) => client.post('/notifications', { notification: data }).then((r) => r.data);
export const broadcastNotification = (data) => client.post('/broadcast_notification', data).then(() => r.data);
export const sendNotificationEmail = (data) => client.post('/notifications/send_notification_email', data).then((r) => r.data);

// ── Profiles ──────────────────────────────────────────────────────────────────
export const getProfile    = (id)       => client.get(`/profiles/${id}`).then((r) => r.data);
export const updateProfile = (id, data) => client.patch(`/profiles/${id}`, { profile: data }).then((r) => r.data);