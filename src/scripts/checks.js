const SEVERITY = {
  CRITICAL: { label: 'Critical', weight: 15, gradient: 'var(--gradient-red)' },
  MAJOR: { label: 'Major', weight: 10, gradient: 'var(--gradient-amber)' },
  MINOR: { label: 'Minor', weight: 5, gradient: 'var(--gradient-blue)' },
  RECOMMENDED: { label: 'Recommended', weight: 2, gradient: 'var(--gradient-purple)' }
};

const STATUS = { PASS: 'pass', FAIL: 'fail', WARN: 'warn', SKIP: 'skip' };

const UCP_CHECKS = [
  {
    id: 'profile-exists',
    name: 'UCP Profile Exists',
    description: 'The store hosts a UCP profile at /.well-known/ucp',
    severity: SEVERITY.CRITICAL,
    check: (response) => {
      if (response.success === true && response.status === 200) {
        return { status: STATUS.PASS, message: 'Profile found successfully', detail: 'The server responded with a 200 OK status code.' };
      }
      return { status: STATUS.FAIL, message: 'Profile not found', detail: `The server responded with status ${response.status || 'unknown'}. Ensure the file exists at /.well-known/ucp.` };
    }
  },
  {
    id: 'valid-json',
    name: 'Valid JSON format',
    description: 'The profile content is valid JSON',
    severity: SEVERITY.CRITICAL,
    check: (response) => {
      if (!response.success || response.status !== 200) return { status: STATUS.SKIP, message: 'Skipped due to missing profile', detail: 'Fix previous errors first.' };
      if (response.data && typeof response.data === 'object') {
        return { status: STATUS.PASS, message: 'Valid JSON parsed', detail: 'The profile content was successfully parsed as JSON.' };
      }
      return { status: STATUS.FAIL, message: 'Invalid JSON', detail: 'The content could not be parsed as a JSON object.' };
    }
  },
  {
    id: 'ucp-root-object',
    name: 'UCP Root Object',
    description: 'The JSON contains a root "ucp" object',
    severity: SEVERITY.CRITICAL,
    check: (response) => {
      if (!response.data || typeof response.data !== 'object') return { status: STATUS.SKIP, message: 'Skipped due to invalid JSON', detail: 'Fix JSON parsing errors first.' };
      if (response.data.ucp && typeof response.data.ucp === 'object' && !Array.isArray(response.data.ucp)) {
        return { status: STATUS.PASS, message: 'Root "ucp" object found', detail: 'The JSON structure contains the required "ucp" object at its root.' };
      }
      return { status: STATUS.FAIL, message: 'Missing root "ucp" object', detail: 'The root of the JSON must contain an object keyed as "ucp".' };
    }
  },
  {
    id: 'protocol-version',
    name: 'Protocol Version',
    description: 'The profile specifies a valid UCP protocol version (YYYY-MM-DD)',
    severity: SEVERITY.CRITICAL,
    check: (response) => {
      if (!response.data?.ucp) return { status: STATUS.SKIP, message: 'Skipped due to missing root object', detail: 'Fix root object structure first.' };
      const version = response.data.ucp.version;
      if (version && /^\d{4}-\d{2}-\d{2}$/.test(version)) {
        return { status: STATUS.PASS, message: `Version ${version} specified`, detail: 'The version field matches the required date format.' };
      }
      return { status: STATUS.FAIL, message: 'Invalid or missing version', detail: 'The "ucp.version" field is missing or not in YYYY-MM-DD format.' };
    }
  },
  {
    id: 'services-declared',
    name: 'Services Declared',
    description: 'The profile declares at least one service under ucp.services',
    severity: SEVERITY.CRITICAL,
    check: (response) => {
      if (!response.data?.ucp) return { status: STATUS.SKIP, message: 'Skipped due to missing root object', detail: 'Fix root object structure first.' };
      const services = response.data.ucp.services;
      if (services && typeof services === 'object' && !Array.isArray(services) && Object.keys(services).length > 0) {
        return { status: STATUS.PASS, message: `${Object.keys(services).length} service(s) declared`, detail: 'The "ucp.services" object contains at least one service.' };
      }
      return { status: STATUS.FAIL, message: 'No services declared', detail: 'The "ucp.services" object is missing or empty.' };
    }
  },
  {
    id: 'service-structure',
    name: 'Service Structure',
    description: 'Each declared service follows the correct schema (version, transport, endpoint)',
    severity: SEVERITY.MAJOR,
    check: (response) => {
      if (!response.data?.ucp?.services || Object.keys(response.data.ucp.services).length === 0) {
        return { status: STATUS.SKIP, message: 'Skipped due to missing services', detail: 'Declare services to check their structure.' };
      }
      const services = response.data.ucp.services;
      let allValid = true;
      for (const [name, serviceArray] of Object.entries(services)) {
        if (!Array.isArray(serviceArray)) {
          allValid = false;
          break;
        }
        for (const srv of serviceArray) {
          if (!srv.version || !srv.transport || !srv.endpoint) {
            allValid = false;
            break;
          }
        }
      }
      if (allValid) {
        return { status: STATUS.PASS, message: 'Valid service structures', detail: 'All service entries contain version, transport, and endpoint fields.' };
      }
      return { status: STATUS.FAIL, message: 'Invalid service structure', detail: 'One or more services are missing required fields or not defined as arrays.' };
    }
  },
  {
    id: 'naming-convention',
    name: 'Naming Convention',
    description: 'Services and capabilities follow reverse-domain format (e.g., dev.ucp.shopping)',
    severity: SEVERITY.MAJOR,
    check: (response) => {
      if (!response.data?.ucp) return { status: STATUS.SKIP, message: 'Skipped due to missing root object', detail: 'Fix root object structure first.' };
      const services = Object.keys(response.data.ucp.services || {});
      const caps = Array.isArray(response.data.ucp.capabilities) ? response.data.ucp.capabilities : [];
      const capabilities = caps.map(c => c?.name);
      const names = [...services, ...capabilities].filter(Boolean);
      if (names.length === 0) return { status: STATUS.SKIP, message: 'No services or capabilities to check', detail: 'Declare items to test naming.' };
      
      const isValid = names.every(n => n.split('.').length >= 3);
      if (isValid) {
        return { status: STATUS.PASS, message: 'Valid naming conventions', detail: 'All names follow the required multi-segment dot notation.' };
      }
      return { status: STATUS.FAIL, message: 'Invalid naming convention', detail: 'Names must have at least 3 dot-separated segments.' };
    }
  },
  {
    id: 'capabilities-declared',
    name: 'Capabilities Declared',
    description: 'The profile declares at least one capability in ucp.capabilities',
    severity: SEVERITY.MAJOR,
    check: (response) => {
      if (!response.data?.ucp) return { status: STATUS.SKIP, message: 'Skipped due to missing root object', detail: 'Fix root object structure first.' };
      const capabilities = response.data.ucp.capabilities;
      if (Array.isArray(capabilities) && capabilities.length > 0) {
        return { status: STATUS.PASS, message: `${capabilities.length} capability/ies declared`, detail: 'The "ucp.capabilities" array has entries.' };
      }
      return { status: STATUS.FAIL, message: 'No capabilities declared', detail: 'The "ucp.capabilities" must be an array with at least one capability.' };
    }
  },
  {
    id: 'capability-structure',
    name: 'Capability Structure',
    description: 'Each capability has name, version, spec, and schema fields',
    severity: SEVERITY.MAJOR,
    check: (response) => {
      if (!Array.isArray(response.data?.ucp?.capabilities) || response.data.ucp.capabilities.length === 0) {
        return { status: STATUS.SKIP, message: 'Skipped due to no capabilities', detail: 'Declare capabilities to check their structure.' };
      }
      const isValid = response.data.ucp.capabilities.every(c => c && c.name && c.version && c.spec && c.schema);
      if (isValid) {
        return { status: STATUS.PASS, message: 'Valid capability structures', detail: 'All capabilities contain name, version, spec, and schema fields.' };
      }
      return { status: STATUS.FAIL, message: 'Invalid capability structure', detail: 'One or more capabilities are missing required fields.' };
    }
  },
  {
    id: 'checkout-capability',
    name: 'Checkout Capability',
    description: 'A checkout capability is provided to enable purchases',
    severity: SEVERITY.RECOMMENDED,
    check: (response) => {
      if (!Array.isArray(response.data?.ucp?.capabilities) || response.data.ucp.capabilities.length === 0) {
        return { status: STATUS.SKIP, message: 'Skipped due to no capabilities', detail: 'Declare capabilities first.' };
      }
      const hasCheckout = response.data.ucp.capabilities.some(c => c && c.name && c.name.includes('checkout'));
      if (hasCheckout) {
        return { status: STATUS.PASS, message: 'Checkout capability found', detail: 'Enables transactional AI agents to perform purchases.' };
      }
      return { status: STATUS.WARN, message: 'No checkout capability', detail: 'Providing a checkout capability is highly recommended for full commerce support.' };
    }
  },
  {
    id: 'https-endpoints',
    name: 'HTTPS Endpoints',
    description: 'All service endpoints use HTTPS',
    severity: SEVERITY.CRITICAL,
    check: (response) => {
      if (!response.data?.ucp?.services) return { status: STATUS.SKIP, message: 'Skipped due to no services', detail: 'Declare services first.' };
      const services = response.data.ucp.services;
      let allHttps = true;
      let checked = 0;
      for (const serviceArray of Object.values(services)) {
        if (!Array.isArray(serviceArray)) continue;
        for (const srv of serviceArray) {
          if (srv && srv.endpoint) {
            checked++;
            if (!srv.endpoint.startsWith('https://')) {
              allHttps = false;
            }
          }
        }
      }
      if (checked === 0) return { status: STATUS.SKIP, message: 'No endpoints to check', detail: 'Services have no endpoints.' };
      if (allHttps) return { status: STATUS.PASS, message: 'All endpoints are HTTPS', detail: 'Secure transport is enforced.' };
      return { status: STATUS.FAIL, message: 'Insecure endpoints detected', detail: 'All endpoints must use the https:// protocol.' };
    }
  },
  {
    id: 'spec-urls-valid',
    name: 'Valid Spec URLs',
    description: 'All spec and schema fields are valid well-formed URLs',
    severity: SEVERITY.MINOR,
    check: (response) => {
      if (!Array.isArray(response.data?.ucp?.capabilities) || response.data.ucp.capabilities.length === 0) {
        return { status: STATUS.SKIP, message: 'Skipped due to no capabilities', detail: 'Declare capabilities first.' };
      }
      let allValid = true;
      const isUrl = (str) => {
        try { new URL(str); return true; } catch { return false; }
      };
      
      for (const cap of response.data.ucp.capabilities) {
        if (cap && cap.spec && !isUrl(cap.spec)) allValid = false;
        if (cap && cap.schema && !isUrl(cap.schema)) allValid = false;
      }
      if (allValid) return { status: STATUS.PASS, message: 'All spec URLs valid', detail: 'Spec and schema fields are well-formed URLs.' };
      return { status: STATUS.FAIL, message: 'Invalid URL formats', detail: 'One or more spec or schema fields are not valid URLs.' };
    }
  },
  {
    id: 'version-consistency',
    name: 'Version Consistency',
    description: 'All capability and service versions follow YYYY-MM-DD format',
    severity: SEVERITY.MAJOR,
    check: (response) => {
      if (!response.data?.ucp) return { status: STATUS.SKIP, message: 'Skipped due to missing root object', detail: 'Fix root object structure first.' };
      const regex = /^\d{4}-\d{2}-\d{2}$/;
      let allValid = true;
      
      const services = response.data.ucp.services || {};
      for (const serviceArray of Object.values(services)) {
        if (Array.isArray(serviceArray)) {
          for (const srv of serviceArray) {
            if (srv && srv.version && !regex.test(srv.version)) allValid = false;
          }
        }
      }
      
      const capabilities = response.data.ucp.capabilities || [];
      for (const cap of capabilities) {
        if (cap && cap.version && !regex.test(cap.version)) allValid = false;
      }
      
      if (allValid) return { status: STATUS.PASS, message: 'Versions are consistently formatted', detail: 'All version fields follow the required date format.' };
      return { status: STATUS.FAIL, message: 'Inconsistent version formats', detail: 'One or more version fields do not follow YYYY-MM-DD format.' };
    }
  },
  {
    id: 'https-host',
    name: 'HTTPS Host',
    description: 'The store itself is served over HTTPS',
    severity: SEVERITY.CRITICAL,
    check: (response) => {
      if (response.https === true) return { status: STATUS.PASS, message: 'Store uses HTTPS', detail: 'Secure connection is properly configured.' };
      return { status: STATUS.FAIL, message: 'Store lacks HTTPS', detail: 'The scanned URL does not use a secure connection.' };
    }
  },
  {
    id: 'content-type',
    name: 'Content-Type Header',
    description: 'The response Content-Type is application/json',
    severity: SEVERITY.MINOR,
    check: (response) => {
      if (!response.success) return { status: STATUS.SKIP, message: 'Skipped due to failed fetch', detail: 'Ensure the profile is accessible.' };
      const ct = response.contentType || '';
      if (ct.includes('application/json') || ct.includes('json')) {
        return { status: STATUS.PASS, message: 'Correct Content-Type', detail: 'The server returns the correct JSON MIME type.' };
      }
      return { status: STATUS.WARN, message: 'Incorrect Content-Type', detail: `Server returned "${ct}" instead of application/json.` };
    }
  }
];

export function runChecks(response) {
  const results = [];
  let totalWeight = 0;
  let earnedWeight = 0;
  let passedCount = 0;
  let failedCount = 0;
  let warnCount = 0;
  
  for (const checkObj of UCP_CHECKS) {
    let status, message, detail;
    
    try {
      const result = checkObj.check(response);
      status = result.status;
      message = result.message;
      detail = result.detail;
    } catch (err) {
      status = STATUS.SKIP;
      message = 'Check encountered an error';
      detail = err.message || 'An unexpected error occurred while running this check.';
    }
    
    results.push({
      id: checkObj.id,
      name: checkObj.name,
      description: checkObj.description,
      severity: checkObj.severity,
      resultStatus: status,
      resultMessage: message,
      resultDetail: detail
    });
    
    if (status !== STATUS.SKIP) {
      totalWeight += checkObj.severity.weight;
      if (status === STATUS.PASS) {
        earnedWeight += checkObj.severity.weight;
        passedCount++;
      } else if (status === STATUS.WARN) {
        warnCount++;
      } else {
        failedCount++;
      }
    }
  }
  
  const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;
  
  let overallStatus = 'non-compliant';
  if (score >= 80) overallStatus = 'compliant';
  else if (score >= 50) overallStatus = 'partial';
  
  return {
    score,
    status: overallStatus,
    totalChecks: UCP_CHECKS.length,
    passed: passedCount,
    failed: failedCount,
    warnings: warnCount,
    results
  };
}
