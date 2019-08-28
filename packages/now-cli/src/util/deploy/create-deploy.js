import generateCertForDeploy from './generate-cert-for-deploy';
import * as ERRORS_TS from '../errors-ts';
import * as ERRORS from '../errors';
import { NowError } from '../now-error';
import mapCertError from '../certs/map-cert-error';

export default async function createDeploy(
  output,
  now,
  contextName,
  paths,
  createArgs
) {
  try {
    return await now.create(paths, createArgs);
  } catch (error) {
    if (error.code === 'rate_limited') {
      return new ERRORS_TS.DeploymentsRateLimited(error.message);
    }

    // Means that the domain used as a suffix no longer exists
    if (error.code === 'domain_missing') {
      return new ERRORS_TS.DomainNotFound(error.value);
    }

    if (error.code === 'domain_not_found' && error.domain) {
      return new ERRORS_TS.DomainNotFound(error.domain);
    }

    // This error occures when a domain used in the `alias`
    // is not yet verified
    if (error.code === 'domain_not_verified' && error.domain) {
      return new ERRORS_TS.DomainNotVerified(error.domain);
    }

    // If the domain used as a suffix is not verified, we fail
    if (error.code === 'domain_not_verified' && error.value) {
      return new ERRORS_TS.DomainVerificationFailed(error.value);
    }

    if (error.code === 'builds_rate_limited') {
      return new ERRORS_TS.BuildsRateLimited(error.message);
    }

    // If the user doesn't have permissions over the domain used as a suffix we fail
    if (error.code === 'forbidden') {
      return new ERRORS_TS.DomainPermissionDenied(error.value, contextName);
    }

    if (error.code === 'bad_request' && error.keyword) {
      return new ERRORS.SchemaValidationFailed(
        error.message,
        error.keyword,
        error.dataPath,
        error.params
      );
    }

    if (error.code === 'domain_configured') {
      return new ERRORS_TS.AliasDomainConfigured(error);
    }

    if (error.code === 'missing_build_script') {
      return new ERRORS_TS.MissingBuildScript(error);
    }

    if (error.code === 'conflicting_file_path') {
      return new ERRORS_TS.ConflictingFilePath(error);
    }

    if (error.code === 'conflicting_path_segment') {
      return new ERRORS_TS.ConflictingPathSegment(error);
    }

    // If the cert is missing we try to generate a new one and the retry
    if (error.code === 'cert_missing') {
      const result = await generateCertForDeploy(
        output,
        now,
        contextName,
        error.value
      );
      if (result instanceof NowError) {
        return result;
      }
      return createDeploy(output, now, contextName, paths, createArgs);
    }

    if (error.code === 'not_found') {
      return new ERRORS_TS.DeploymentNotFound({ context: contextName });
    }

    const certError = mapCertError(error)
    if (certError) {
      return certError;
    }

    // If the error is unknown, we just throw
    throw error;
  }
}