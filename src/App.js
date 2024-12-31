import 'bootstrap/dist/css/bootstrap.min.css';
import React, { useState, useEffect } from 'react';
import Web3 from 'web3';
import './App.css';
import ContractABI from './ContractABI.json'; 

let web3;
let contract;

function App() {
  const [account, setAccount] = useState('');
  const [owner, setOwner] = useState('');
  const [balance, setBalance] = useState(0);
  const [collectedFees, setCollectedFees] = useState(0);
  const [campaignFee, setCampaignFee] = useState(0);
  const [liveCampaigns, setLiveCampaigns] = useState([]);
  const [fulfilledCampaigns, setFulfilledCampaigns] = useState([]);
  const [canceledCampaigns, setCanceledCampaigns] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [newCampaign, setNewCampaign] = useState({ title: '', pledgeCost: '', numPledges: '' });

  const contractAddress = '0x8DDA4bec6e420d9F2b54D6bBa27C901cAd806Dd8';

  const getBackerShares = async (campaignId, accountAddress) => {
    const backersData = await contract.methods.getBackers(campaignId).call();
    const backers = backersData[0];
    const count = backers.filter((backer) => backer === accountAddress).length;
    return count;
  };

  const fetchDetails = async () => {
    const accounts = await web3.eth.getAccounts();
    setAccount(accounts[0]);

    contract = new web3.eth.Contract(ContractABI, contractAddress);

    const contractOwners = await contract.methods.getOwners().call();
    setOwner(contractOwners);

    const userBalance = await web3.eth.getBalance(accounts[0]);
    setBalance(web3.utils.fromWei(userBalance, 'ether'));

    const fee = await contract.methods.campaignFee().call();
    setCampaignFee(web3.utils.fromWei(fee.toString(), 'ether'));

    const collectedFees = await contract.methods.feesCollected().call();
    setCollectedFees(web3.utils.fromWei(collectedFees.toString(), 'ether'));

    const refunds = await contract.methods.pendingRefunds(accounts[0]).call();
    setRefunds(web3.utils.fromWei(refunds.toString(), 'ether'));

    const liveCampaignsIds = await contract.methods.getActiveCampaigns().call();
    const liveCampaignsDetails = await Promise.all(
      liveCampaignsIds.map(async (id) => {
        const details = await contract.methods.getCampaignDetails(id).call();
        const shares = await getBackerShares(id, accounts[0]);
        return {
          id,
          title: details[0],
          entrepreneur: details[1],
          pledgeCost: web3.utils.fromWei(details[2], 'ether'),
          pledgesNeeded: details[3],
          pledgesCount: details[4],
          pledgesByMsgSender: shares,
          canUserCancelOrFulfill: details[1] === accounts[0] || contractOwners.indexOf(accounts[0]) > -1,
          canComplete: details[4] >= details[3]

        };
      })
    );
    setLiveCampaigns(liveCampaignsDetails);
    
    const fulfilledCampaignsIds = await contract.methods.getCompletedCampaigns().call();
    
    const fulfilledCampaignsDetails = await Promise.all(
      fulfilledCampaignsIds.map(async (id) => {
        const details = await contract.methods.getCampaignDetails(id).call();
        const shares = await getBackerShares(id, accounts[0]);
        return {
          id,
          title: details[0],
          entrepreneur: details[1],
          pledgeCost: web3.utils.fromWei(details[2], 'ether'),
          pledgesNeeded: details[3],
          pledgesCount: details[4],
          pledgesByMsgSender: shares
        };
      })
    );
    setFulfilledCampaigns(fulfilledCampaignsDetails);

    const canceledCampaignsIds = await contract.methods.getCancelledCampaigns().call();
    const canceledCampaignsDetails = await Promise.all(
      canceledCampaignsIds.map(async (id) => {
        const details = await contract.methods.getCampaignDetails(id).call();
        const shares = await getBackerShares(id, accounts[0]);
        return {
          id,
          title: details[0],
          entrepreneur: details[1],
          pledgeCost: web3.utils.fromWei(details[2], 'ether'),
          pledgesNeeded: details[3],
          pledgesCount: details[4],
          pledgesByMsgSender: shares
        };
      })
    );
    setCanceledCampaigns(canceledCampaignsDetails);
  };

  const setupEventListeners = () => {
    const events = [
      'CampaignCreated',
      'PledgeMade',
      'CampaignCancelled',
      'CampaignCompleted',
      'RefundIssued',
      'InvestorRefunded',
      'OwnershipTransferred',
      'ContractDestroyed',
      'InvestorClaimedAllRefunds'
    ];
  
    events.forEach(event => {
      contract.events[event]().on('data', async (data) => {
        console.log(`${event} event:`, data);
        await fetchDetails();
      });
    });
  };

  // Web3 initialization
  useEffect(() => {
    async function initWeb3() {
      if (window.ethereum) {
        web3 = new Web3(window.ethereum);
        try {
          await window.ethereum.request({ method: 'eth_requestAccounts' });
          await fetchDetails();
          setupEventListeners();
        } catch (error) {
          console.error('Error connecting to web3: ', error);
        }
      } else {
        alert('Please install MetaMask to use this DApp.');
      }
    }

    initWeb3();
  }, []);

  // Placeholder functions for interacting with the contract
  const createCampaign = async () => {
    try {
      const { title, pledgeCost, numPledges } = newCampaign;
      await contract.methods.createCampaign(title, web3.utils.toWei(pledgeCost, 'ether'), numPledges).send({ from: account, value: web3.utils.toWei(campaignFee, 'ether') });
      alert('Campaign created successfully!');
    } catch (error) {
      console.error('Error creating campaign:', error);
      alert('Failed to create campaign.');
    }
  };

  const pledgeToCampaign = async (index) => {
    console.log('Pledging to campaign:', liveCampaigns[index]);
    try {
      await contract.methods.pledge(liveCampaigns[index].id).send({ from: account, value: web3.utils.toWei(liveCampaigns[index].pledgeCost, 'ether') });
      alert('Pledged to campaign successfully!');
    }catch (error) {
      console.error('Error pledging to campaign:', error);
      alert('Failed to pledge to campaign.');
    }

  };

  const cancelCampaign = async (index) => {
    console.log('Canceling campaign:', liveCampaigns[index]);
    try {
      await contract.methods.cancelCampaign(liveCampaigns[index].id).send({ from: account });
      alert('Campaign canceled successfully!');
    }
    catch (error) {
      console.error('Error canceling campaign:', error);
      alert('Failed to cancel campaign.');
    }
  };

  const fulfillCampaign = async (index) => {
    console.log('Fulfilling campaign:', liveCampaigns[index]);
    try {
      await contract.methods.completeCampaign(liveCampaigns[index].id).send({ from: account });
      alert('Campaign fulfilled successfully!');
    } catch (error) {
      console.error('Error fulfilling campaign:', error);
      alert('Failed to fulfill campaign.');
    }
  };

  const withdrawAllRefunds = async () => {
    console.log('Withdrawing all refunds');
    try {
      await contract.methods.withdrawAllRefunds().send({ from: account });
      alert('Refunds withdrawn successfully!');
    }catch (error) {
      console.error('Error withdrawing refunds:', error);
      alert('Failed to withdraw refunds.');
    }
  };

  const withdrawFunds = async () => {
    console.log('Withdrawing funds');
    try {
      await contract.methods.withdrawPlatformFees().send({ from: account });
      alert('Funds withdrawn successfully!');
    }catch (error) {
      console.error('Error withdrawing funds:', error);
      alert('Failed to withdraw funds.');
    }
  };

  const changeOwner = async (newOwner) => {
    console.log('Changing owner to:', newOwner);
    try{
      await contract.methods.transferOwnership(newOwner).send({ from: account });
      alert('Owner changed successfully!');
    }catch (error) {
      console.error('Error changing owner:', error);
      alert('Failed to change owner.');
    }


  };

  const banEntrepreneur = async (address) => {
    console.log('Banning entrepreneur:', address);
    try {
      await contract.methods.banEntrepreneur(address).send({ from: account });
      alert('Entrepreneur banned successfully!');
    }catch (error) {
      console.error('Error banning entrepreneur:', error);
      alert('Failed to ban entrepreneur.');
    }
  };

  const destroyContract = async () => {
    console.log('Destroying contract');
    try {
      await contract.methods.destroyContract().send({ from: account });
      alert('Contract destroyed successfully!');
    }catch (error) {
      console.error('Error destroying contract:', error);
      alert('Failed to destroy contract.');
    }
  };


  // UI Rendering
  return (
    <div className="container my-4">
      <h2 className="text-center mb-4">Crowdfunding DApp - ics22178</h2>

      {/* Address Info */}
      <div className="mb-4">
        <div className="mb-3">
          <label className="form-label">Current Address</label>
          <input
            type="text"
            className="form-control"
            readOnly
            value={account}
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Owner's Address</label>
          <input
            type="text"
            className="form-control"
            readOnly
            value={owner}
          />
        </div>
        <div className="row">
          <div className="col">
            <label className="form-label">Balance</label>
            <input type="text" className="form-control" readOnly value={balance} />
          </div>
          <div className="col">
            <label className="form-label">Collected Fees</label>
            <input type="text" className="form-control" readOnly value={collectedFees} />
          </div>
        </div>
      </div>
      <hr></hr>
      {/* New Campaign */}
      <div className="border p-3 mb-4">
        <h5>New Campaign - Fee: {campaignFee} ETH</h5>
        <div className="mb-3">
          <label className="form-label">Title</label>
          <input 
            type="text" 
            className="form-control" 
            placeholder="Campaign's ID" 
            value={newCampaign.title}
            onChange={(e) => setNewCampaign({ ...newCampaign, title: e.target.value })}
          />
        </div>
        <div className="row mb-3">
          <div className="col">
            <label className="form-label">Pledge Cost</label>
            <input 
              type="number" 
              className="form-control" 
              placeholder="0.01" 
              value={newCampaign.pledgeCost}
              onChange={(e) => setNewCampaign({ ...newCampaign, pledgeCost: e.target.value })}
            />
          </div>
          <div className="col">
            <label className="form-label">Number of Pledges</label>
            <input 
              type="number" 
              className="form-control" 
              placeholder="200" 
              value={newCampaign.numPledges}
              onChange={(e) => setNewCampaign({ ...newCampaign, numPledges: e.target.value })}
            />
          </div>
        </div>
        <button className="btn btn-primary w-100" onClick={createCampaign}>Create</button>
      </div>

      {/* Live Campaigns */}
      <h5>Live Campaigns</h5>
      <table className="table table-bordered mb-4">
        <thead>
          <tr>
            <th>Entrepreneur</th>
            <th>Title</th>
            <th>Pledge Cost</th>
            <th>Pledges Needed</th>
            <th>Pledges Count</th>
            <th>Your Pledges</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
        {liveCampaigns.map((campaign, index) => (
          <tr key={index}>
            <td>{campaign.entrepreneur}</td>
            <td>{campaign.title}</td>
            <td>{campaign.pledgeCost} ETH</td>
            <td>{campaign.pledgesNeeded}</td>
            <td>{campaign.pledgesCount}</td>
            <td>{campaign.pledgesByMsgSender}</td>
            <td>
              <button className="btn btn-success btn-sm" onClick={() => pledgeToCampaign(index)}>Pledge</button>
              {campaign.canUserCancelOrFulfill && (
                <>
                  <button className="btn btn-success btn-sm" disabled={!campaign.canComplete} onClick={() => fulfillCampaign(index)}>Complete</button>
                  <button className="btn btn-danger btn-sm" onClick={() => cancelCampaign(index)}>Cancel</button>
                </>
              )}
            </td>
          </tr>
        ))}
      </tbody>
      </table>
      {/* Fulfilled Campaigns */}
      <h5>Fulfilled Campaigns</h5>
      <table className="table table-bordered mb-4">
        <thead>
          <tr>
            <th>Entrepreneur</th>
            <th>Title</th>
            <th>Pledge Cost</th>
            <th>Pledges Needed</th>
            <th>Pledges Count</th>
            <th>Your Pledges</th>
          </tr>
        </thead>
        <tbody>
          {fulfilledCampaigns.map((campaign, index) => (
            <tr key={index}>
              <td>{campaign.entrepreneur}</td>
              <td>{campaign.title}</td>
              <td>{campaign.pledgeCost} ETH</td>
              <td>{campaign.pledgesNeeded}</td>
              <td>{campaign.pledgesCount}</td> 
              <td>{campaign.pledgesByMsgSender}</td>
              </tr>
          ))}
        </tbody>
      </table>

      {/* Canceled Campaigns */}
      <h5>Canceled Campaigns</h5>
      <button className="btn btn-success btn-sm" disabled={refunds <= 0} onClick={() => withdrawAllRefunds()}>Claim</button>
      <p>Pending Refunds: {refunds} ETH</p>
      <table className="table table-bordered mb-4">
        <thead>
          <tr>
            <th>Entrepreneur</th>
            <th>Title</th>
            <th>Pledge Cost</th>
            <th>Pledges Needed</th>
            <th>Pledges Count</th>
            <th>Your Pledges</th>
          </tr>
        </thead>
        <tbody>
          {canceledCampaigns.map((campaign, index) => (
            <tr key={index}>
              <td>{campaign.entrepreneur}</td>
              <td>{campaign.title}</td>
              <td>{campaign.pledgeCost} ETH</td>
              <td>{campaign.pledgesNeeded}</td>
              <td>{campaign.pledgesCount}</td> 
              <td>{campaign.pledgesByMsgSender}</td>
              
            </tr>
          ))}
        </tbody>
      </table>
      <hr></hr>
      {/* Control Panel */}
      <div className="border p-3">
        <h5>Control Panel</h5>
        <div className="row mb-3">
          <div className="col">
            <button className="btn btn-success w-100" disabled={owner.indexOf(account) === -1} onClick={withdrawFunds}>Withdraw</button>
          </div>
        </div>
        <div className="mb-3">
          <input
            type="text"
            className="form-control"
            placeholder="Enter new owner's wallet address"
            onChange={(e) => changeOwner(e.target.value)}
            disabled={owner.indexOf(account) === -1}
          />
          <button className="btn btn-warning w-100 mt-2" disabled={owner.indexOf(account) === -1}>Change Owner</button>
        </div>
        <div className="mb-3">
          <input
            type="text"
            className="form-control"
            placeholder="Enter entrepreneur's address"
            onChange={(e) => banEntrepreneur(e.target.value)}
            disabled={owner.indexOf(account) === -1}
          />
          <button className="btn btn-danger w-100 mt-2" disabled={owner.indexOf(account) === -1}>Ban Entrepreneur</button>
        </div>
        <button className="btn btn-dark w-100" onClick={destroyContract} disabled={owner.indexOf(account) === -1}>Destroy</button>
      </div>

    </div>
  );
}

export default App;