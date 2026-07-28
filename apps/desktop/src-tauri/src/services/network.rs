use std::net::IpAddr;
use std::time::Duration;

use reqwest::header::{AUTHORIZATION, HeaderValue};
use reqwest::{Client, Url};
use serde::Deserialize;
use serde_json::Value;

use crate::error::AppError;
use crate::services::{credentials, permissions, validate_segment};
use crate::state::CoreState;

const MAX_URL_BYTES: usize = 4_096;
const MAX_RESPONSE_BYTES: u64 = 1_048_576;

pub struct NetworkState {
    client: Client,
}

impl NetworkState {
    pub fn new() -> Result<Self, AppError> {
        let client = Client::builder()
            .connect_timeout(Duration::from_secs(5))
            .timeout(Duration::from_secs(12))
            .redirect(reqwest::redirect::Policy::none())
            .user_agent("ToolCenter/0.1")
            .build()
            .map_err(|_| {
                AppError::new(
                    "network.client-failed",
                    "The shared HTTPS client could not be initialized.",
                )
            })?;
        Ok(Self { client })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkJsonRequest {
    url: String,
    authorization: Option<NetworkAuthorization>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NetworkAuthorization {
    credential_key: String,
    scheme: AuthorizationScheme,
}

#[derive(Debug, Deserialize)]
enum AuthorizationScheme {
    #[serde(rename = "apikey")]
    ApiKey,
    #[serde(rename = "Bearer")]
    Bearer,
}

pub async fn get_json(
    network: &NetworkState,
    core: &CoreState,
    plugin_id: &str,
    request: NetworkJsonRequest,
) -> Result<Value, AppError> {
    validate_segment(plugin_id, "plugin id")?;
    permissions::require(core, plugin_id, "network.request")?;
    let url = validate_url(&request.url)?;
    let mut builder = network.client.get(url);

    if let Some(authorization) = request.authorization {
        validate_segment(&authorization.credential_key, "credential key")?;
        let secret = credentials::read(plugin_id, &authorization.credential_key)?;
        let prefix = match authorization.scheme {
            AuthorizationScheme::ApiKey => "apikey",
            AuthorizationScheme::Bearer => "Bearer",
        };
        let value = HeaderValue::from_str(&format!("{prefix} {secret}")).map_err(|_| {
            AppError::new(
                "network.authorization-invalid",
                "The secure credential cannot be used as an authorization header.",
            )
        })?;
        builder = builder.header(AUTHORIZATION, value);
    }

    let response = builder.send().await.map_err(|_| {
        AppError::new(
            "network.request-failed",
            "The HTTPS request could not be completed.",
        )
    })?;
    if !response.status().is_success() {
        return Err(AppError::new(
            "network.http-error",
            format!("The HTTPS service returned status {}.", response.status()),
        ));
    }
    if response
        .content_length()
        .is_some_and(|size| size > MAX_RESPONSE_BYTES)
    {
        return Err(AppError::new(
            "network.response-too-large",
            "The HTTPS response exceeds the 1 MiB limit.",
        ));
    }

    let bytes = response.bytes().await.map_err(|_| {
        AppError::new(
            "network.response-failed",
            "The HTTPS response could not be read.",
        )
    })?;
    if bytes.len() as u64 > MAX_RESPONSE_BYTES {
        return Err(AppError::new(
            "network.response-too-large",
            "The HTTPS response exceeds the 1 MiB limit.",
        ));
    }
    serde_json::from_slice(&bytes).map_err(|_| {
        AppError::new(
            "network.json-invalid",
            "The HTTPS response is not valid JSON.",
        )
    })
}

fn validate_url(raw: &str) -> Result<Url, AppError> {
    if raw.is_empty() || raw.len() > MAX_URL_BYTES {
        return Err(AppError::invalid_input(
            "Network URLs must contain between 1 and 4096 bytes.",
        ));
    }
    let url = Url::parse(raw).map_err(|_| AppError::invalid_input("Network URL is invalid."))?;
    if url.scheme() != "https" {
        return Err(AppError::invalid_input(
            "Only HTTPS network requests are allowed.",
        ));
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err(AppError::invalid_input(
            "Network URLs cannot contain user information.",
        ));
    }
    if url.port_or_known_default() != Some(443) {
        return Err(AppError::invalid_input(
            "Only the standard HTTPS port is allowed.",
        ));
    }
    let host = url
        .host_str()
        .ok_or_else(|| AppError::invalid_input("Network URL must contain a host."))?
        .to_ascii_lowercase();
    if host == "localhost"
        || host.ends_with(".localhost")
        || host.ends_with(".local")
        || host.ends_with(".internal")
        || host.parse::<IpAddr>().is_ok()
    {
        return Err(AppError::invalid_input(
            "Local and IP-literal network targets are not allowed.",
        ));
    }
    Ok(url)
}

#[cfg(test)]
mod tests {
    use super::validate_url;

    #[test]
    fn accepts_public_https_urls() {
        let url = validate_url("https://api.twelvedata.com/time_series?symbol=AAPL")
            .expect("public HTTPS URL should be accepted");
        assert_eq!(url.host_str(), Some("api.twelvedata.com"));
    }

    #[test]
    fn rejects_non_https_local_and_credentialed_urls() {
        assert!(validate_url("http://api.example.com/data").is_err());
        assert!(validate_url("https://localhost/data").is_err());
        assert!(validate_url("https://127.0.0.1/data").is_err());
        assert!(validate_url("https://name:secret@example.com/data").is_err());
        assert!(validate_url("https://example.com:8443/data").is_err());
    }
}
