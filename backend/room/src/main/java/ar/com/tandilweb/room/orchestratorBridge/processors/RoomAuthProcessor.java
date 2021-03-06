package ar.com.tandilweb.room.orchestratorBridge.processors;

import java.io.File;
import java.io.IOException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.core.JsonParseException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import ar.com.tandilweb.exchange.roomAuth.Handshake;
import ar.com.tandilweb.exchange.roomAuth.SignupData;
import ar.com.tandilweb.exchange.roomAuth.SignupResponse;
import ar.com.tandilweb.exchange.roomAuth.TokenUpdate;
import ar.com.tandilweb.room.handlers.RoomHandler;
import ar.com.tandilweb.room.protocols.EpprRoomAuth;

@Component
public class RoomAuthProcessor extends OrchestratorGenericProcessor{

	@Autowired
	private EpprRoomAuth roomAuthProto;
	
	@Autowired
	private RoomHandler roomHandler;
	
	public static Logger logger = LoggerFactory.getLogger(RoomAuthProcessor.class);
	
	public void processSignupSchema(String schemaBody) throws JsonProcessingException {
		logger.debug("Processing processSignupSchema.");
		SignupData signupData = roomAuthProto.getSignupSchema();
		ObjectMapper om = new ObjectMapper();
		sendDataToServer(om.writeValueAsString(signupData));
	}

	public void processSignupResponseSchema(String schemaBody) {
		try {
			ObjectMapper objectMapper = new ObjectMapper();
			SignupResponse signupResponse = objectMapper.readValue(schemaBody, SignupResponse.class);
			Handshake handshake = roomAuthProto.getHandshakeSchema();
			handshake.serverID = signupResponse.serverID;
			roomHandler.setRoomID(signupResponse.serverID);
			handshake.securityToken = signupResponse.securityToken;
			objectMapper.writeValue(new File(cfgFileSave + File.separator + "lastHandshake.json"), handshake);
			logger.debug("Processed processSignupResponseSchema. New server ID:" + signupResponse.serverID);
		} catch (IOException e) {
			logger.error("I/O Exception in processSignupResponseSchema", e);
		}
	}

	// FIXME: validate retry times
	public void processRetrySchema(String schemaBody) throws JsonProcessingException {
		logger.debug("Processing processRetrySchema.");
		try {
			Handshake hs = roomAuthProto.getHandshakeSchema();
			ObjectMapper om = new ObjectMapper();
			sendDataToServer(om.writeValueAsString(hs));
		} catch (IOException e) {
			logger.error("I/O Exception (processRetrySchema): ", e);
		}
	}

	public void processRejectedSchema(String schemaBody) {
		logger.error("The registration was rejected by the Orchestrator server.");
		// TODO: check this, verify if really close the backend:
//		((ConfigurableApplicationContext) context).close();
	}

	public void processExceededSchema(String schemaBody) {
		logger.error("You exceeded the limit of signups.");
		// TODO: check this, verify if really close the backend:
//		((ConfigurableApplicationContext) context).close();
	}

	// TODO: finish this
	public void processTokenUpdate(String schemaBody) throws JsonParseException, JsonMappingException {
		try {
			ObjectMapper om = new ObjectMapper();
			TokenUpdate signupResponse = om.readValue(schemaBody, TokenUpdate.class);
			File configuration = new File(cfgFileSave + File.separator + "lastHandshake.json");
			if (configuration.exists()) {
				logger.debug("Processing processTokenUpdate. new token [" + signupResponse.securityToken + "]");
				ObjectMapper objectMapper = new ObjectMapper();
				Handshake handshake = objectMapper.readValue(configuration, Handshake.class);
				handshake.securityToken = signupResponse.securityToken;
				objectMapper.writeValue(new File(cfgFileSave + File.separator + "lastHandshake.json"), handshake);
			} else {
				logger.error("Configuration file isn't exists and cant be updated with new token: "
						+ signupResponse.securityToken);
			}
		} catch (IOException e) {
			logger.error("I/O Exception in processTokenUpdate", e);
		}
	}

	public void processBusySchema(String schemaBody) throws JsonProcessingException {
		logger.debug("Processing processBusySchema.");
		try {
			Handshake hs = roomAuthProto.getHandshakeSchema();
			ObjectMapper om = new ObjectMapper();
			logger.info("Waiting for...");
			Thread.sleep(3500); // TODO: param this 3500 sleep time.
			logger.info("Retrying");
			sendDataToServer(om.writeValueAsString(hs));
		} catch (IOException e) {
			logger.error("I/O Exception in process busy schema: ", e);
		} catch (InterruptedException e) {
			logger.error("Interrupted Exception in process busy schema:", e);
		}
	}

}
