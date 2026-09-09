import client from './client';

// Properties
export const listProperties = (params) => client.get('/properties', { params }).then(r => r.data);
export const getProperty = (id) => client.get(`/properties/${id}`).then(r => r.data);
export const createProperty = (payload) => client.post('/properties', payload).then(r => r.data);
export const updateProperty = (id, payload) => client.put(`/properties/${id}`, payload).then(r => r.data);
export const deleteProperty = (id) => client.delete(`/properties/${id}`).then(r => r.data);
export const getPropertyUnits = (id) => client.get(`/properties/${id}/units`).then(r => r.data);
export const getPropertyPlots = (id) => client.get(`/properties/${id}/plots`).then(r => r.data);
export const getPropertyAmenities = (id) => client.get(`/properties/${id}/amenities`).then(r => r.data);
export const addPropertyAmenity = (id, payload) => client.post(`/properties/${id}/amenities`, payload).then(r => r.data);

// Upload media files (to Cloudinary via user-service); returns array of { url, type, name, size }
export const uploadPropertyMedia = async (files) => {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  const res = await client.post('/media/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.files ?? [];
};

// Persist the full images array on a property
export const updatePropertyImages = (id, images) =>
  client.put(`/properties/${id}`, { images }).then(r => r.data);

// Property Types
export const listPropertyTypes = (params) => client.get('/property-types', { params }).then(r => r.data);
export const createPropertyType = (payload) => client.post('/property-types', payload).then(r => r.data);
export const updatePropertyType = (id, payload) => client.put(`/property-types/${id}`, payload).then(r => r.data);
export const deletePropertyType = (id) => client.delete(`/property-types/${id}`).then(r => r.data);

// Measurement-unit catalog (global list of sqm/plot/acre...), NOT per-property config
export const listPropertyUnits = (params) => client.get('/property-units', { params }).then(r => r.data);
export const deleteUnitCatalogEntry = (id) => client.delete(`/property-units/${id}`).then(r => r.data);
export const createUnitCatalogEntry = (payload) => client.post('/property-units', payload).then(r => r.data);

// Unit configurations belonging to one property (quantity / size / measured-in / price)
export const addPropertyUnitConfig = (propertyId, payload) =>
  client.post(`/properties/${propertyId}/units`, payload).then(r => r.data);
export const updatePropertyUnitConfig = (propertyId, unitId, payload) =>
  client.put(`/properties/${propertyId}/units/${unitId}`, payload).then(r => r.data);
export const deletePropertyUnitConfig = (propertyId, unitId) =>
  client.delete(`/properties/${propertyId}/units/${unitId}`).then(r => r.data);

// Property approval workflow
export const submitPropertyForApproval = (id) => client.post(`/properties/${id}/submit`).then(r => r.data);
export const approveProperty = (id, payload) => client.post(`/properties/${id}/approve`, payload).then(r => r.data);
export const rejectProperty = (id, payload) => client.post(`/properties/${id}/reject`, payload).then(r => r.data);
export const requestRevision = (id, payload) => client.post(`/properties/${id}/request-revision`, payload).then(r => r.data);

// Property documents
export const getPropertyDocuments = (id) => client.get(`/properties/${id}/documents`).then(r => r.data);
export const addPropertyDocument = (id, payload) => client.post(`/properties/${id}/documents`, payload).then(r => r.data);
export const deletePropertyDocument = (id) => client.delete(`/property-documents/${id}`).then(r => r.data);

// Public share link (authenticated management)
export const createPropertyPublicLink = (id, payload) => client.post(`/properties/${id}/public-link`, payload).then(r => r.data);
export const revokePropertyPublicLink = (id) => client.delete(`/properties/${id}/public-link`).then(r => r.data);

// Public property view — reachable without a token
export const getPublicProperty = (token) => client.get(`/public/properties/${token}`).then(r => r.data);

// ── Excel export / bulk import ────────────────────────────────────────────────

/** Pulls the filename the server chose, falling back to a sensible default. */
const filenameFrom = (response, fallback) => {
  const header = response.headers?.['content-disposition'] || '';
  const match = header.match(/filename="?([^"';]+)"?/i);
  return match ? match[1] : fallback;
};

/** Triggers a browser download for a blob response. */
const saveBlob = (response, fallbackName) => {
  const url = URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = filenameFrom(response, fallbackName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

/**
 * With responseType 'blob' an error body also arrives as a Blob, so the usual
 * error.userMessage is useless. Re-read it as text and surface the real message.
 */
const withBlobError = async (request, fallbackName) => {
  try {
    saveBlob(await request, fallbackName);
  } catch (error) {
    const body = error?.response?.data;
    if (body instanceof Blob) {
      try {
        const { message } = JSON.parse(await body.text());
        if (message) error.userMessage = message;
      } catch {
        // Not JSON — leave the interceptor's message in place.
      }
    }
    throw error;
  }
};

export const exportPropertiesToExcel = (params) =>
  withBlobError(client.get('/properties/export', { params, responseType: 'blob' }), 'properties.xlsx');

export const downloadBulkTemplate = () =>
  withBlobError(client.get('/properties/bulk-template', { responseType: 'blob' }), 'property-bulk-upload-template.xlsx');

export const bulkImportProperties = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return client.post('/properties/bulk-import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
};

// ── Listed properties (read-only catalogue for realtors and clients) ──────────
export const listListedProperties = (params) => client.get('/properties/listed', { params }).then(r => r.data);
export const getListedProperty = (id) => client.get(`/properties/listed/${id}`).then(r => r.data);

/** Idempotent share token for a listed property (never rotates). */
export const getPropertyShareLink = (id) => client.post(`/properties/${id}/share-link`).then(r => r.data);

/** Records buyer intent against a shared property. Requires an account. */
export const createPurchaseRequest = (payload) => client.post('/purchase-requests', payload).then(r => r.data);

export const listPurchaseRequests = (propertyId) =>
  client.get(`/properties/${propertyId}/purchase-requests`).then(r => r.data);

/** Validates availability, prices server-side, creates the request + invoice. */
export const checkoutProperty = (propertyId, payload) =>
  client.post(`/properties/${propertyId}/checkout`, payload).then(r => r.data);
