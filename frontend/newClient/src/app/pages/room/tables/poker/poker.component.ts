import { RoomService } from 'src/app/services/network/room.service';
import { Component, OnInit, ViewChildren, QueryList } from '@angular/core';
import { PlayerSnapshot } from './PlayerSnapshot';
import { Card } from '../../cards/dual-stack/Card';
import { RxEType } from 'src/app/services/network/ReactionEvents';
import { VcardComponent } from '../../vcard/vcard.component';

@Component({
  selector: 'app-table-poker',
  templateUrl: './poker.component.html',
  styleUrls: ['./poker.component.scss']
})
export class PokerComponent implements OnInit {

  private static MAX_PLAYERS = 10;

  public players: PlayerSnapshot[];
  public zones = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

  public tableCards: Card[];
  public availablePositions: boolean[] = [];
  public pot: number;
  public dealed: boolean;
  public dealerPosition: number = -1;
  public myPosition: number;
  public resultMode: boolean;

  public info: string;

  @ViewChildren(VcardComponent) vcards: QueryList<VcardComponent>;

  constructor(private room: RoomService) { }

  ngOnInit() {
    this.players = [];
    this.tableCards = [];
    for (let i = 0; i < PokerComponent.MAX_PLAYERS; i++) {
      this.players.push(new PlayerSnapshot());
      this.availablePositions.push(false);
    }
    this.room.reactionEvent.subscribe(evt => {
      if (evt.type === RxEType.ANNOUNCEMENT) {
        // this.announcement =
        const nPlayer = new PlayerSnapshot();
        nPlayer.playerDetails.chips = evt.data.chips;
        nPlayer.playerDetails.image = evt.data.avatar;
        nPlayer.playerDetails.name = evt.data.user;
        this.players[evt.data.position] = nPlayer;

        this.availablePositions[evt.data.position] = false;
      }
      if (evt.type === RxEType.START_IN) {
        this.info = 'Game start in ' + evt.data + (evt.data !== 1 ? ' seconds' : ' second');
      }
      if (evt.type === RxEType.ROUND_START) {
        this.info = undefined; // removing info box
        // reseting final statuses:
        // TODO: reset the table status.
        this.dealerPosition = evt.data.dealerPosition;
        this.dealed = false;
        this.players.forEach(player => {
          player.cards = [];
          player.upsidedown = false;
        });
        this.tableCards = [null, null, null, null, null];
        this.resultMode = false;
        this.pot = 0;
      }
      if (evt.type === RxEType.BLINDS) {
        this.pot = evt.data.sbChips + evt.data.bbChips;
        this.players[evt.data.sbPosition].playerDetails.chips -= evt.data.sbChips;
        this.players[evt.data.bbPosition].playerDetails.chips -= evt.data.bbChips;
        this.players[evt.data.sbPosition].actualBet = evt.data.sbChips;
        this.players[evt.data.bbPosition].actualBet = evt.data.bbChips;
        this.dealed = true;
      }
      if (evt.type === RxEType.CARD_DIST) {
        if (evt.data.position !== 1) {
          this.players[evt.data.position].upsidedown = true;
          this.players[evt.data.position].cards = evt.data.cards;
        }
      }
      if (evt.type === RxEType.ME_CARD_DIST) {
        this.players[evt.data.position].upsidedown = false;
        this.players[evt.data.position].cards = evt.data.cards;
      }
      if (evt.type === RxEType.WAITING_FOR) {
        // data.position+' for: '+data.remainingTime
        this.players.forEach((player, idx) => {
          if (player) {
            this.players[idx].timeRest = idx === evt.data.position ? evt.data.remainingTime : undefined;
            if (idx === evt.data.position) {
              this.vcards.toArray()[idx].startTimeRest(evt.data.remainingTime);
            } else {
              this.vcards.toArray()[idx].finishActions();
            }
          }
        });
      }
      if (evt.type === RxEType.DONE_ACTION) {
        this.players[this.myPosition].timeRest = undefined;
      }
      if (evt.type === RxEType.INGRESS) {
        this.myPosition = evt.data.position;
        for (let i = 0; i < PokerComponent.MAX_PLAYERS; i++) {
          this.availablePositions[i] = false;
        }
      }
      if (evt.type === RxEType.FLOP) {
        this.players.forEach((player, idx) => {
          this.vcards.toArray()[idx].finishActions();
        });
        this.tableCards[0] = evt.data[0];
        this.tableCards[1] = evt.data[1];
        this.tableCards[2] = evt.data[2];
        // clear chips
        this.clearTableChips();
      }
      if (evt.type === RxEType.TURN) {
        this.players.forEach((player, idx) => {
          this.vcards.toArray()[idx].finishActions();
        });
        this.tableCards[3] = evt.data;
        // clear chips
        this.clearTableChips();
      }
      if (evt.type === RxEType.RIVER) {
        this.players.forEach((player, idx) => {
          this.vcards.toArray()[idx].finishActions();
        });
        this.tableCards[4] = evt.data;
        // clear chips
        this.clearTableChips();
      }
      if (evt.type === RxEType.SNAPSHOT) {
        console.log('SNAPSHOT', evt.data);
        this.dealerPosition = evt.data.dealerPosition;
        evt.data.players.forEach((player, idx) => {
          console.log(idx, player);
          if (player != null) {
            const nPlayer = new PlayerSnapshot();
            nPlayer.playerDetails.chips = player.chips;
            nPlayer.playerDetails.image = player.photo;
            nPlayer.playerDetails.name = player.nick;
            this.players[idx] = nPlayer;
          }
        });
      }
      if (evt.type === RxEType.DEFINE_POSITION) {
        evt.data.forEach(freePositions => {
          this.availablePositions[freePositions] = true;
        });
      }
      if (evt.type === RxEType.DECISION_INFORM) {
        this.players[evt.data.position].playerDetails.chips -= evt.data.ammount;
        this.players[evt.data.position].actualBet += evt.data.ammount;
        this.pot += evt.data.ammount;
      }
      if (evt.type === RxEType.SHOW_OFF) {
        this.players.forEach((player, idx) => {
          if (player) {
            this.players[idx].timeRest = undefined;
          }
        });
        evt.data.positionCards.forEach((cards, idx) => {
          if (cards) {
            this.players[idx].cards = [cards.first, cards.second];
            this.players[idx].upsidedown = false;
          }
        });
        this.clearTableChips();
      }
      if (evt.type === RxEType.RESULT_SET) {
        // result set
        console.info('RESULT SET', evt.data);
        this.players.forEach(player => {
          if (player) {
            player.winner = false;
          }
        });
        evt.data.winners.forEach(winner => {
          this.resultMode = true;
          this.players[winner.position].winner = true;
          this.players[winner.position].playerDetails.chips += winner.pot;
        });
      }
      if (evt.type === RxEType.DEPOSIT_SUCCESS) {
        if (this.players[this.myPosition]) {
          this.players[this.myPosition].playerDetails.chips += evt.data.chips;
        }
      }
    });
  }

  trySeat(position: number) {
    if (this.availablePositions[position]) {
      if (this.players[position].playerDetails.name) {
        // TODO: improve this alert:
        alert('This position is in use.');
      } else {
        console.warn('Sitting...');
        this.room.selectPosition(position);
      }
    }
  }

  private clearTableChips() {
    this.players.forEach(player => {
      if (player) {
        player.actualBet = 0;
      }
    });
  }

}
